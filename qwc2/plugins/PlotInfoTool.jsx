/**
 * Copyright 2019-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import isEmpty from 'lodash.isempty';
import axios from 'axios';
import FileSaver from 'file-saver';
import {logAction} from 'qwc2/actions/logging';
import ConfigUtils from 'qwc2/utils/ConfigUtils';
import {clearSearch} from 'qwc2/actions/search';
import {setCurrentTask} from 'qwc2/actions/task';
import {LayerRole, addThemeSublayer, addLayerFeatures, removeLayer} from 'qwc2/actions/layers';
import ResizeableWindow from 'qwc2/components/ResizeableWindow';
import Spinner from 'qwc2/components/widgets/Spinner';
import Icon from 'qwc2/components/Icon';
import {zoomToPoint} from 'qwc2/actions/map';
import {UrlParams} from 'qwc2/utils/PermaLinkUtils';
import CoordinatesUtils from 'qwc2/utils/CoordinatesUtils';
import LocaleUtils from 'qwc2/utils/LocaleUtils';
import MapSelection from '../components/MapSelection';
import VectorLayerUtils from 'qwc2/utils/VectorLayerUtils';
import './style/PlotInfoTool.css';


class PlotInfoTool extends React.Component {
    static propTypes = {
        addLayerFeatures: PropTypes.func,
        addThemeSublayer: PropTypes.func,
        clearSearch: PropTypes.func,
        currentTask: PropTypes.string,
        customInfoComponents: PropTypes.object,
        infoQueries: PropTypes.array,
        logAction: PropTypes.func,
        map: PropTypes.object,
        removeLayer: PropTypes.func,
        selection: PropTypes.object,
        setCurrentTask: PropTypes.func,
        theme: PropTypes.object,
        themeLayerRestorer: PropTypes.func,
        toolLayers: PropTypes.array,
        windowSize: PropTypes.object,
        zoomToPoint: PropTypes.func
    };
    static defaultProps = {
        toolLayers: [],
        infoQueries: [],
        customInfoComponents: {},
        windowSize: {width: 500, height: 800}
    };
    state = {
        plotInfo: null,
        currentPlot: null,
        expandedInfo: null,
        expandedInfoData: null,
        pendingPdfs: [],
        selectionGeom: null,
        selectionActive: false,
        isLoading : false,
        expanded : false,
        expandedSubTables: {},
        expandedSubInfoData: null
    };
    componentDidMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }
    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.props.theme && !prevProps.theme) {
            if (UrlParams.getParam('realty') !== undefined) {
                this.props.setCurrentTask('PlotInfoTool');
            } else {
                for (const entry of this.props.infoQueries) {
                    if (entry.urlKey && UrlParams.getParam(entry.urlKey)) {
                        this.props.setCurrentTask('PlotInfoTool');
                        this.queryInfoByEgrid(entry, UrlParams.getParam(entry.urlKey));
                        UrlParams.updateParams({[entry.urlKey]: undefined});
                        break;
                    }
                }
            }
        } else if (this.props.currentTask === 'PlotInfoTool' && prevProps.currentTask !== 'PlotInfoTool') {
            this.activated();
        } else if (this.props.currentTask !== 'PlotInfoTool' && prevProps.currentTask === 'PlotInfoTool') {
            this.deactivated();
        } else if (this.props.currentTask === 'PlotInfoTool' && this.state.selectionGeom &&
           this.state.selectionGeom !== prevState.selectionGeom) {
          this.setState({isLoading: true})
            this.queryBasicInfoAtPoint(this.state.selectionGeom);
        }
        if (this.state.plotInfo) {
            if (
                this.state.plotInfo !== prevState.plotInfo ||
                this.state.currentPlot !== prevState.currentPlot
            ) {
                const layer = {
                    id: "plotselection",
                    role: LayerRole.SELECTION
                };
                const feature = this.state.plotInfo.features[this.state.currentPlot];
                feature.styleName = 'default';
                feature.styleOptions = {
                    fillColor: [0, 0, 0, 0],
                    strokeColor: [242, 151, 84, 0.75],
                    strokeWidth: 4,
                    strokeDash: []
                };
                this.props.addLayerFeatures(layer, [feature], true);
            }
        } else if (prevState.plotInfo && !this.state.plotInfo) {
            this.props.removeLayer("plotselection");
        }
    }
    render() {
        return (
            <>
                {this.state.selectionGeom ? (
                    <ResizeableWindow
                        icon="plot_info"
                        initialHeight={this.props.windowSize.height}
                        initialWidth={this.props.windowSize.width}
                        initialX={0}
                        initialY={0}
                        onClose={() => this.props.setCurrentTask(null)}
                        scrollable={true}
                        title="Information Cadastrale"
                    >
                        {this.renderBody()}
                    </ResizeableWindow>
                ) :  (
                    <MapSelection
                        active={this.state.selectionActive}
                        geomType={'Point'}
                        geometry={this.state.selectionGeom}
                        cursor={`url("${ConfigUtils.getAssetsPath()}/img/plot-info-marker.png") 12 12, default`}
                        geometryChanged={(geom) => this.setState({selectionGeom: geom})}
                        styleOptions={{fillColor: [0, 0, 0, 0], strokeColor: [0, 0, 0, 0]}}
                    />
                )}
            </>
        );
    }
    renderBody = () => {
      if ( this.state.plotInfo){
        const plotServiceUrl = ConfigUtils.getConfigProp("plotInfoService").replace(/\/$/, '');
        const plot = this.state.plotInfo.features[this.state.currentPlot];
        const params = {
            idprocpte: plot.properties.idprocpte,
            idpar: plot.id,
            code_insee: plot.properties.idcom,
            fields: 'all'
        }
        return (
            <div className="plot-info-dialog-body" role="body">
                <div className="plot-info-dialog-header">
                    {this.state.plotInfo.features.map((entry, idx) => ([(
                        <div className="plot-info-result-header" key={"result-header-" + idx} onClick={() => this.toggleCurrentPlot(idx)}>
                            <Icon icon={this.state.currentPlot === idx ? "collapse" : "expand"} />
                            <span>{entry.id}</span>
                            {this.state.pendingPdfs.includes(entry.id) ? (<Spinner />) :
                                (<Icon class="icon icon-pdf icon_clickable" icon="pdf" onClick={ev => this.queryPdf(ev, entry)} title='Impression PDF' />)}
                        </div>
                    ), this.state.currentPlot !== idx ? null : (
                        <div className="plot-info-result-body" key={"result-body-" + idx}>
                            <table><tbody>
                                <tr key='code'>
                                    <td>Code</td>
                                    <td><div>{(plot.properties.ccosec ?? '') + (plot.properties.dnupla ?? '')}</div></td>
                                </tr>
                                <tr key='voie'>
                                    <td>Voie</td>
                                    <td><div style={{textTransform: 'capitalize'}}>{((plot.properties.dnuvoi?.replace(/^0+/, '') ?? '') + (plot.properties.dindic ?? '') + ' ' + (plot.properties.cconvo ?? '') + ' ' + (plot.properties.dvoilib ?? '')).toLowerCase()}</div></td>
                                </tr>
                                <tr key='Commune'>
                                    <td>Commune</td>
                                    <td><div style={{textTransform: 'capitalize'}}>{(plot.properties.idcomtxt ?? '').toLowerCase()}</div></td>
                                </tr>
                                <tr key='code-rivoli'>
                                    <td>Rivoli</td>
                                    <td><div>{(plot.properties.ccoriv ?? '')}</div></td>
                                </tr>
                                <tr key='date-acte'>
                                    <td>Date de l'acte</td>
                                    <td><div>{(plot.properties.jdatat.replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3') ?? '')}</div></td>
                                </tr>
                                <tr key='contenance'>
                                    <td>Contenance</td>
                                    <td><div>{(plot.properties.dcntpa ?? '') + ' m²'}</div></td>
                                </tr>
                            </tbody></table>
                        </div>

                    )]))}
                </div>
                <div className="plot-info-dialog-queries">
                {this.props.infoQueries.map((entry) => {
                        let query = entry.query
                        if (!query.startsWith('http')) {
                            query = plotServiceUrl + query;
                        }
                        let pdfQuery = entry.pdfQuery ? entry.pdfQuery.replace('$egrid$', plot.egrid) : null;
                        if (pdfQuery && !pdfQuery.startsWith('http')) {
                            pdfQuery = plotServiceUrl + pdfQuery;
                        }
                        const pdfTooltip = entry.pdfTooltip ? LocaleUtils.tr(entry.pdfTooltip) : "";
                        const expanded = this.state.expandedInfo === entry.key;
                        return [
                            (
                                <div className="plot-info-dialog-query-title" key={entry.key + "-title"} onClick={() => this.toggleEgridInfo(entry, query, params)}>
                                    <Icon icon={expanded ? "collapse" : "expand"} />
                                    <span>{entry.titleMsgId ? LocaleUtils.tr(entry.titleMsgId) : entry.title}</span>
                                    {entry.pdfQuery ?
                                        this.state.pendingPdfs.includes(pdfQuery) ? (<Spinner />) :
                                            (<Icon icon="pdf" onClick={ev => this.queryPdf(ev, entry, pdfQuery)} title={pdfTooltip} />)
                                        : null}
                                </div>
                            ),
                            expanded ? (
                                <div className="plot-info-dialog-query-result" key={entry.key + "-result"}>
                                    {!this.state.expandedInfoData ? this.renderWait() : this.state.expandedInfoData.failed ? this.renderError() : this.renderInfoData(entry.key)}
                                </div>
                            ) : null
                        ];
                    })}
                </div>
            </div>
        );
      }
      if (this.state.isLoading && !this.plotInfo) {
        return (
          <div className="plot-info-dialog-body" role="body">
            <div className="plot-info-dialog-query-loading">
              <Spinner />
              <span>Chargement...</span>
            </div>
          </div>
        );
      }
    };
    toggleCurrentPlot = (idx) => {
        if (this.state.currentPlot !== idx) {
            this.setState({currentPlot: idx, expandedInfo: null, expandedInfoData: null, pendingPdfs: []});
        }
    };
    renderWait = () => {
        return (
            <div className="plot-info-dialog-query-loading">
                <Spinner />
                <span>Chargement...</span>
            </div>
        );
    };
    renderError = () => {
        return (
            <div className="plot-info-dialog-query-failed">
                {this.state.expandedInfoData.failed === true ? LocaleUtils.tr("plotinfotool.failed") : LocaleUtils.tr(this.state.expandedInfoData.failed)}
            </div>
        );
    };
    renderInfoData = (key) => {
        const { expandedInfoData } = this.state;
        if (!expandedInfoData || !expandedInfoData.results || expandedInfoData.results.length === 0) {
            return this.renderError();
        }
        if (key === 'locaux') {
            return expandedInfoData.results.map((plot, index) => {
                const isLastTable = index === expandedInfoData.results.length - 1;
                const params = {
                    idprocpte: plot.idprocpte,
                    idpar: plot.id,
                    code_insee: plot.idcom,
                    fields: 'all'
                }
                return (
                  <React.Fragment key={`result-fragment-locaux-${index}`}>
                    <table
                      className="plot-info-table"
                      key={`result-table-${index}`}
                      style={{
                        borderBottom: isLastTable ? 'none' : '1px solid #ccc',
                        marginBottom: '5px'
                      }}
                    >
                      <tbody>
                        <tr key={`invar-${index}`}>
                          <td>Invariant</td>
                          <td><div>{((plot.invar ?? '') + ' ' + (plot.cleinvar ?? ''))}</div></td>
                        </tr>
                        <tr key={`voie-${index}`}>
                          <td>Voie</td>
                          <td>
                            <div style={{ textTransform: 'capitalize' }}>
                              {((plot.dnvoiri?.replace(/^0+/, '') ?? '') + (plot.dindic ?? '') + ' ' + (plot.cconvo ?? '') + ' ' + (plot.dvoilib ?? '')).toLowerCase()}
                            </div>
                          </td>
                        </tr>
                        <tr key={`porte-${index}`}>
                          <td>Porte</td>
                          <td><div>{(plot.dpor ?? '')}</div></td>
                        </tr>
                        <tr key={`entree-${index}`}>
                          <td>Bâtiment-Entrée-Niveau</td>
                          <td><div>{((plot.dnubat ?? '') + '-' + (plot.descc ?? '') + '-' + (plot.dniv ?? ''))}</div></td>
                        </tr>
                          <tr>
                            <td colSpan="2">
                              <div
                                className="plot-info-dialog-subquery-title"
                                onClick={() => this.toggleSubInfo(index, ConfigUtils.getConfigProp("plotInfoService").replace(/\/$/, '') + '/proprios', params)}
                              >
                                    {this.state.expandedSubTables[index] ? (
                                        <><Icon icon="collapse" />&nbsp;Propriétaires</>
                                    ) : (
                                        <><Icon icon="expand" />&nbsp;Propriétaires</>
                                    )}
                              </div>
                              {this.state.expandedSubTables[index] && (
                                  <div key={index + "-result"}>
                                      {!this.state.expandedSubInfoData ? this.renderWait() : this.state.expandedSubInfoData.failed ? this.renderError() : <table style={{marginLeft:"18px"}}>
                                          <tbody>
                                            {this.state.expandedSubInfoData.results.map((subItem, subIndex) => (
                                              <React.Fragment key={`sub-row-${subIndex}`}>
                                                <tr style={{ paddingLeft: '20px' }}>
                                                    <td style={{ textTransform: 'capitalize'}}>
                                                        {this.state.expandedSubInfoData.results.length > 1 ? `Propriétaire ${subIndex + 1}` : 'Propriétaire'}
                                                    </td>
                                                    <td style={{ textTransform: 'capitalize'}}>{subItem.ddenom.toLowerCase()}</td>
                                                </tr>
                                                <tr style={{ paddingLeft: '20px' }}>
                                                    <td style={{ textTransform: 'capitalize'}}>
                                                        {this.state.expandedSubInfoData.results.length > 1 ? `Code droit ${subIndex + 1}` : 'Code droit'}
                                                    </td>
                                                    <td style={{ textTransform: 'capitalize'}}>{ subItem.ccodrotxt.toLowerCase()}</td>
                                                </tr>
                                              </React.Fragment>
                                            ))}
                                          </tbody>
                                      </table>}
                                  </div>
                              ) }
                            </td>
                          </tr>
                      </tbody>
                    </table>
                  </React.Fragment>
                );
            });
        }
        if (key === 'proprietaires') {
            return expandedInfoData.results.map((plot, index) => {
                const isLastTable = index === expandedInfoData.results.length - 1;
                return (
                    <React.Fragment key={`result-fragment-proprietaires-${index}`}>
                        <table
                            className="plot-info-table"
                            key={`result-table-${index}`}
                            style={{
                                borderBottom: isLastTable ? 'none' : '1px solid #ccc',
                                marginBottom: '5px'
                            }}>
                            <tbody>
                                <tr key={`ddenom-${index}`}>
                                    <td>Nom</td>
                                    <td><div style={{ textTransform: 'capitalize'}}>{(plot.ddenom.toLowerCase() ?? '')}</div></td>
                                </tr>
                                <tr key={`ccodrotxt-${index}`}>
                                    <td>Code droit</td>
                                    <td><div style={{ textTransform: 'capitalize'}}>{(plot.ccodrotxt.toLowerCase() ?? '')}</div></td>
                                </tr>
                            </tbody>
                        </table>
                    </React.Fragment>
                );
            });
        }
    };
    activated = () => {
        this.setState({selectionActive: true})
    };
    handleKeyDown = (event) => {
        if (event.key === 'Escape' && this.state.selectionActive) {
            this.deactivated();
        }
    };
    deactivated = () => {
        this.setState({plotInfo: null, currentPlot: null, expandedInfo: null, expandedInfoData: null, pendingPdfs: [], selectionActive: false, selectionGeom: null, expandedSubInfoData: null, expandedSubTables: {}});
    };
    toggleSubInfo = (index, queryUrl, params) => {
        this.setState(prevState => {
            const newExpandedSubTables = { ...prevState.expandedSubTables };
            const isCurrentlyExpanded = newExpandedSubTables[index];
            Object.keys(newExpandedSubTables).forEach(key => {
                newExpandedSubTables[key] = false;
            });
            if (!isCurrentlyExpanded) {
                newExpandedSubTables[index] = true;
            }
            return {
                expandedSubTables: newExpandedSubTables,
                expandedSubInfoData: null
            };
        }, () => {
            if (!this.state.expandedSubTables[index]) return;
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `token ${this.props.token}`,
            };
            axios.get(queryUrl, { params, headers })
                .then(response => {
                    this.setState({
                        expandedSubInfoData: response.data || { failed: infoEntry.failMsgId || true }
                    });
                })
                .catch(() => {
                    this.setState({ expandedSubInfoData: { failed: infoEntry.failMsgId || true } });
                });
        });
    };
    queryBasicInfoAtPoint = (point) => {
        this.props.clearSearch();
        point = CoordinatesUtils.reproject(point.coordinates, this.props.map.projection, "EPSG:4326")
        const serviceUrl = ConfigUtils.getConfigProp("plotInfoService").replace(/\/$/, '') + '/';
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `token ${this.props.token}`,
        };
        const params = {
            contains_geom: JSON.stringify({
                type: 'Point',
                coordinates: [point[0], point[1]]
            }),
            in_bbox: `${point[0] - 0.000000001},${point[1] - 0.000000001},${point[0] + 0.000000001},${point[1] + 0.000000001}`,
            fields: 'all'
        };
        axios.get(serviceUrl + '/geoparcelles', {params, headers}).then(response => {
            const plotInfo = !isEmpty(response.data) ? response.data : null;
            plotInfo.features[0].geometry = VectorLayerUtils.reprojectGeometry(plotInfo.features[0].geometry ,'EPSG:4326', this.props.map.projection);
            this.setState({plotInfo: plotInfo, currentPlot: 0, expandedInfo: null, expandedInfoData: null, isLoading: false});
        }).catch(() => {this.setState({plotInfo: null, currentPlot: 0, expandedInfo: null, expandedInfoData: null, isLoading: false});});
    };
    queryPdf = (ev, infoEntry) => {
        this.props.logAction("PLOTINFO_PDF_QUERY", {info: infoEntry.id});
        ev.stopPropagation();
        this.setState((state) => ({pendingPdfs: [...state.pendingPdfs, infoEntry.id]}));
        const params = {
            parcelle: infoEntry.id,
            token: this.props.token
        };
        axios.get(this.props.pdfQueryUrl, {params, responseType: 'blob', validateStatus: status => status >= 200 && status < 300 && status !== 204}).then(response => {
            const contentType = response.headers["content-type"];
            let filename = infoEntry.id + '.pdf';
            try {
                const contentDisposition = response.headers["content-disposition"];
                filename = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition)[1];
            } catch (e) {
                /* Pass */
            }
            FileSaver.saveAs(new Blob([response.data], {type: contentType}), filename);
            this.setState((state) => ({pendingPdfs: state.pendingPdfs.filter(entry => entry !== infoEntry.id)}));
        }).catch(() => {
            this.setState((state) => ({pendingPdfs: state.pendingPdfs.filter(entry => entry !== infoEntry.id)}));
            const errorMsg = infoEntry.failMsgId ? LocaleUtils.tr(infoEntry.failMsgId) : "";
            // eslint-disable-next-line
            alert(errorMsg || "Print failed");
        });
    };
    toggleEgridInfo = (infoEntry, queryUrl, params) => {
        if (this.state.expandedInfo === infoEntry.key) {
            this.setState({ expandedInfo: null, expandedInfoData: null });
        } else {
            this.props.logAction("PLOTINFO_QUERY", { info: infoEntry.key });
            this.setState({ expandedInfo: infoEntry.key, expandedInfoData: null });
            if (infoEntry.key === 'locaux') {
                delete params.idprocpte;
            }
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `token ${this.props.token}`
            };
            axios.get(queryUrl, { params, headers }).then(response => {
                this.setState({ expandedInfoData: response.data || { failed: infoEntry.failMsgId || true } });
            }).catch(() => {
                this.setState({ expandedInfoData: { failed: infoEntry.failMsgId || true } });
            });
        }
    };
}

const selector = state => ({
    selection: state.selection,
    map: state.map,
    theme: state.theme.current,
    currentTask: state.task.id
});

export default connect(
    selector,
    {
        setCurrentTask: setCurrentTask,
        addThemeSublayer: addThemeSublayer,
        addLayerFeatures: addLayerFeatures,
        removeLayer: removeLayer,
        zoomToPoint: zoomToPoint,
        clearSearch: clearSearch,
        logAction: logAction
    }
)(PlotInfoTool);
