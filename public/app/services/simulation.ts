module App {
    import ProjectLayer = csComp.Services.ProjectLayer;
    import ProjectGroup = csComp.Services.ProjectGroup;
    import NotifyType = csComp.Services.NotifyType;

    /** Specific simulation */
    export interface ISimWebSimulationVersion {
        name: string;
        version: string;
    }

    /** Simulator metadata */
    export interface ISimWebSimulation {
        name: string;
        versions: string[];
    }
    /** Simulator metadata listing */
    export interface ISimWebSimulations {
        [key: string]: ISimWebSimulation;
    }

    /** Infrastructure summary*/
    export interface ISimWebSummary {
        tasks: {name: string, value: number}[];
        jobs: {name: string, value: number}[];
    }

    /** Raw CouchDB view. */
    export interface ISimWebList<RowContent> {
        total_rows: number;
        offset: number;
        rows: {id: string, key: string, value: RowContent}[];
    }

    /** Task data. */
    export interface ITask {
        _id: string;  // ID
        _rev: string;  // CouchDB revision
        url?: string;  // url of the task
        lock: number;  // time (seconds) the task has started processing (0 if not yet started)
        done: number;  // time (seconds) the task was completed (0 if not completed, -1 if in error)
        error: {
            time: number,
            message?: string,
            exception?: string
        }[]; // errors occurred during processing
        input: {
            simulation: string; // simulation name
            ensemble: string; // ensemble name
            [key: string]: any;
        };
        output?: any; // output values
        uploads?: { [key: string]: string }; // filename: urls of uploaded files
        _attachments?: { [key: string]: any }; // CouchDB attachments
        typeUrl?: string; // url of the feature type
        defaultFeatureType: string; // name of the default feature type if any
        hostname?: string; // hostname the task was last processed on
        name?: string; // simulation name
        ensemble?: string; // ensemble name
        scrub_count?: number; // number of times the task was restarted after error
        type?: string; // document type: "task"
        version?: string; // simulation engine version
        command?: string; // simulation engine command
        arguments?: string[]; // simulation engine arguments
    }

    /**
     * Interface to the SIM-CITY webservice
     *
     * All methods take a webservice base URL.
     */
    export class SimWebService {
        public static $inject = ['layerService', 'messageBusService', '$http', '$q'];

        private simulationsCache: StringMap<ISimWebSimulations>;

        constructor(private layerService: csComp.Services.LayerService,
                    private messageBusService: csComp.Services.MessageBusService,
                    private $http: ng.IHttpService,
                    private $q: ng.IQService) {
            this.simulationsCache = {};
        }

        /** List all tasks from a given simulator of a given version. */
        public list(webserviceUrl: string, simulation: string, version: string): ng.IHttpPromise<ISimWebList<ITask>> {
            return this.$http.get(webserviceUrl + '/view/simulations/' + simulation + '/' + version);
        }

        /** Get a detailed task view of a single task. */
        public get(webserviceUrl: string, id: string): ng.IHttpPromise<ITask> {
            return this.$http.get(webserviceUrl + '/simulation/' + id);
        }

        /** Start a job on the infrastructure. */
        public startJob(webserviceUrl: string, host: string = null): ng.IPromise<any> {
            return this.$http.post(host ? webserviceUrl + '/job/' + host : webserviceUrl + '/job', null)
                .then(null, response => {
                    if (response.status === 503) {
                        response.message = 'Already enough jobs running';
                        return this.$q.reject({message: 'Already enough jobs running', response: response});
                    } else {
                        return this.$q.reject(SimWebService.formatHTTPError(response.data, response.status,
                            response.statusText, 'error starting job'));
                    }
                });
        }

        /** List possible simulators. */
        public simulations(webserviceUrl: string): ng.IPromise<ISimWebSimulations>  {
            if (this.simulationsCache[webserviceUrl]) {
                return this.$q.resolve(this.simulationsCache[webserviceUrl]);
            } else {
                return this.$http.get(webserviceUrl + '/simulate')
                    .then(response => {
                        this.simulationsCache[webserviceUrl] = <ISimWebSimulations> response.data;
                        return this.simulationsCache[webserviceUrl];
                    });
            }
        }

        /** Submit a new task to the webservice, where the parameters adhere to the JSON Schema of the simulator. */
        public submit(webserviceUrl: string, simulation: string, version: string, params: any): ng.IPromise<{name: string, url: string}> {
            var url = webserviceUrl + '/simulate/' + simulation;
            if (version) {
                url += '/' + version;
            }
            return this.$http.post(url, params)
                .then(result => {
                    let returnUrl = result.headers('Location');
                    return {
                        url: returnUrl,
                        name: returnUrl.substr(returnUrl.lastIndexOf('/') + 1)
                    };
                }, response => {
                    let detailedMessage = SimWebService.formatHTTPError(response.data, response.status, response.statusText, 'error starting simulation');
                    var message = 'Cannot add \'' + params.name + '\'';
                    if (response.status === 400 && response.data && response.data.error) {
                        message += ': ' + response.data.error;
                    } else if (response.status === 500) {
                        message += ': internal server error';
                    } else if (response.status === 502) {
                        message += ': cannot reach database';
                    }
                    return this.$q.reject({message: message, detailedMessage: detailedMessage});
                });
        }

        /** Delete a task. If the task is currently active, it may re-appear. */
        public delete(webserviceUrl: string, id: string, rev: string): ng.IHttpPromise<void> {
            return this.http('DELETE', webserviceUrl + '/simulation/' + id, {rev: rev});
        }

        /** Summary of the infrastructure that the webservice is currently using. */
        public summary(webserviceUrl: string): ng.IPromise<ISimWebSummary> {
            return this.$http.get(webserviceUrl + '/view/totals')
                .then(response => {
                    let data = <any> response.data;
                    return {
                        tasks: [
                            {name: 'queued', value: <number> data.todo},
                            {name: 'processing', value: <number> data.locked},
                            {name: 'done', value: <number> data.done},
                            {name: 'with error', value: <number> data.error}
                        ],
                        jobs: [
                            {name: 'active', value: <number> data.active_jobs},
                            {name: 'pending', value: <number> data.pending_jobs},
                            {name: 'finished', value: <number> data.finished_jobs}
                        ]
                    };
                }, response => {
                    var status;
                    if (response.status === 0) {
                        status = '';
                    } else {
                        status = '(code ' + response.status + ')';
                    }
                    return this.$q.reject({message: 'Cannot load infrastructure overview ' + status});
                });
        }

        /** Make a HTTP call, passing given parameters in the URL. */
        private http(method: string, url: string, params: any): ng.IHttpPromise<any> {
            return this.$http({
                method: method,
                url: url,
                params: params,
                headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'}
            });
        }

        /** Format an error message from given HTTP response. */
        private static formatHTTPError(data: any, status: number, statusText: string, defaultMsg: string): {message: string, httpStatusMessage: string, formatted: string} {
            let msg = data.error || defaultMsg;
            let httpStatusMsg = '(HTTP status ' + status + ': ' + statusText + ')';

            return {
                message: msg,
                httpStatusMessage: httpStatusMsg,
                formatted: msg + ' ' + httpStatusMsg
            };
        }

        public visualize(webserviceUrl: string, task: ITask, name: string, attachment: Object, type: string) {
            // Calculate the correct url to the result
            let url;
            if (type === 'attachment') {
                url = webserviceUrl + '/simulation/' + task._id + '/' + name;
            } else if (type === 'upload') {
                url = attachment;
            }

            console.log('visualizing ' + name + ' at: ' + url);

            // Make sure the layer group exists
            let groupId = task.input.ensemble + '_' + task.input.simulation;
            let group = this.layerService.findGroupById(groupId);
            if (group === null) {
                let newGroup = new ProjectGroup();
                newGroup.id = groupId;
                newGroup.languages = {
                    'en': {
                        'title': task.input.ensemble + ': ' + task.input.simulation,
                        'description': 'Layers added manually for test purposes'
                    }
                };
                newGroup.clustering = true;

                group = ProjectGroup.deserialize(newGroup);

                this.layerService.project.groups.push(group);
                this.layerService.initGroup(group);
            }

            // Add the data as a layer
            let layerId = task._id + '_' + name;
            if (!this.layerService.findLayer(layerId)) {
                let newLayer = new ProjectLayer();

                newLayer.id = layerId;
                newLayer.title = name;
                newLayer.type = 'geojson';
                newLayer.renderType = 'geojson';
                newLayer.url = url;
                newLayer.timeAware = false;
                newLayer.opacity = 75;

                if (task.hasOwnProperty('typeUrl')) {
                    newLayer.typeUrl = task.typeUrl;
                }
                if (task.hasOwnProperty('defaultFeatureType')) {
                    newLayer.defaultFeatureType = task.defaultFeatureType;
                }


                this.layerService.initLayer(group, newLayer);
                group.layers.push(newLayer);

                this.messageBusService.notify('Result added', 'Results from file <b>' + name +
                                              '</b> added to layer in layer group <b>' + group.title + '</b>',
                                              undefined, NotifyType.Success);
            } else {
                this.messageBusService.notify('Result already available', 'Results from file <b>' +
                                              name + '</b> are already available in layer group <b>' +
                                              group.title + '</b>', undefined, NotifyType.Success);
            }
        }
    }

    angular
        .module('csWebApp')
        .service('SimWebService', SimWebService);
}
