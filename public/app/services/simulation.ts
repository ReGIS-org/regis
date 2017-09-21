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

    /** Project Layer Subset needed for creation */
    export interface ILayerDescription {
        id: string;
        title: string;
        type: 'geojson' | 'editablegeojson';
        url?: string;
        timeAware?: boolean;
        opacity?: number;
        typeUrl?: string;
        defaultFeatureType?: string;
        data?: {[key: string] : any};
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
        files?: { [name: string]: GeoJsonFileDescription }; // filename: urls of uploaded files
        _attachments?: { [name: string]: GeoJsonFileDescription }; // CouchDB attachments
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
        filelist? : { [name: string]: GeoJsonFileDescription };
    }

    export interface GeoJsonFileDescription {
        length: number;
        content_type: string;
        url?: string;
        digest?: string;
    }

    /** Job data. */
    export interface IJob {
        queue: number;
        start: number;
        done: number;
        hostname: string;
        method: string;
        startDate?: Date;
    }

    export interface IHost {
        default: boolean;
    }

    export interface ISimWebObject<RowContent> {
        [key: string] : RowContent;
    }

    /**
     * Interface to the SIM-CITY webservice
     *
     * All methods take a webservice base URL.
     */
    export class SimWebService {
        public static $inject = ['SimAdminService', 'SchemaService', 'layerService', 'messageBusService', '$http', '$q', '$log'];

        private simulationsCache: ng.IPromise<{}>;

        constructor(private SimAdminService: App.SimAdminService,
                    private SimSchemaService: App.SchemaService,
                    private layerService: csComp.Services.LayerService,
                    private messageBusService: csComp.Services.MessageBusService,
                    private $http: ng.IHttpService,
                    private $q: ng.IQService,
                    private $log: ng.ILogService) {
            this.simulationsCache = this.SimAdminService.getWebserviceUrl()
                .then(webserviceUrl => this.$http.get(webserviceUrl + '/simulate'))
                .then(response => response.data);
        }

        /** List all tasks from a given simulator of a given version. */
        public list(simulation: string, version: string): ng.IHttpPromise<ISimWebList<ITask>> {
            return this.SimAdminService.getWebserviceUrl()
                .then(webserviceUrl => this.$http.get(webserviceUrl + '/view/simulations/' + simulation + '/' + version));
        }

        /** Get a detailed task view of a single task. */
        public get(id: string): ng.IPromise<ITask> {
            return this.SimAdminService.getWebserviceUrl()
                .then((webserviceUrl : string) : ng.IHttpPromise<ITask>  => this.$http.get(webserviceUrl + '/simulation/' + id))
                .then((result : ng.IHttpPromiseCallbackArg<ITask>) : ITask => {
                    let task: ITask = result.data;
                    task.filelist = {};
                    if (task._attachments) {
                        Object.keys(task._attachments).forEach((name : string) => {
                            task.filelist[name] = task._attachments[name];
                        });
                    }
                    if (task.files) {
                        Object.keys(task.files).forEach((name : string) => {
                            task.filelist[name] = task.files[name];
                        });
                    }
                    return task;
                });
        }

        /** Start a job on the infrastructure. */
        public startJob(host: string = null): ng.IPromise<any> {
            return this.SimAdminService.getWebserviceUrl()
                .then(webserviceUrl => this.$http.post(host ? webserviceUrl + '/job?host=' + host : webserviceUrl + '/job', null))
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

        public jobs() : ng.IHttpPromise<ISimWebList<IJob>> {
            return this.SimAdminService.getWebserviceUrl()
                .then(webserviceUrl => this.$http.get(webserviceUrl + '/view/jobs/'));
        }

        public hosts() : ng.IHttpPromise<ISimWebObject<IHost>> {
            return this.SimAdminService.getWebserviceUrl()
                .then(webserviceUrl => this.$http.get(webserviceUrl + '/hosts/'));
        }

        /** List possible simulators. */
        public simulations(): ng.IPromise<{}>  {
            return this.simulationsCache;
        }

        /** Submit a new task to the webservice, where the parameters adhere to the JSON Schema of the simulator. */
        public submit(simulation: string, version: string, params: any): ng.IPromise<{name: string, url: string}> {
            return this.SimAdminService.getWebserviceUrl()
                .then(webserviceUrl => {
                    var url = webserviceUrl + '/simulate/' + simulation;
                    if (version) {
                        url += '/' + version;
                    }
                    return this.$http.post(url, params);
                })
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
        public delete(id: string, rev: string): ng.IHttpPromise<void> {
            return this.SimAdminService.getWebserviceUrl()
                .then(webserviceUrl => this.http('DELETE', webserviceUrl + '/simulation/' + id, {rev: rev}));
        }

        /** Summary of the infrastructure that the webservice is currently using. */
        public summary(): ng.IPromise<ISimWebSummary> {
            return this.SimAdminService.getWebserviceUrl()
                .then(webserviceUrl => this.$http.get(webserviceUrl + '/view/totals'))
                .then(response => {
                    let data = <any> response.data;
                    return {
                        tasks: [
                            {name: 'Pending', value: <number> data.pending},
                            {name: 'Processing', value: <number> data.in_progress},
                            {name: 'Done', value: <number> data.done},
                            {name: 'With error', value: <number> data.error}
                        ],
                        jobs: [
                            {name: 'Running', value: <number> data.running_jobs},
                            {name: 'Pending', value: <number> data.pending_jobs},
                            {name: 'Finished', value: <number> data.finished_jobs}
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

        public getAttachmentUrl(task: ITask, name: string): ng.IPromise<string> {
            return this.SimAdminService.getWebserviceUrl().then(webserviceUrl => {
                return webserviceUrl + '/simulation/' + task._id + '/' + name;
            });
        }

        public visualize(task: ITask, name: string) {
            // Calculate the correct url to the result
            return this.getAttachmentUrl(task, name).then(url => {
                this.$log.info('visualizing ' + name + ' at: ' + url);

                // Make sure the layer group exists
                let groupId = task.input.ensemble + '_' + task.input.simulation;
                let group = this.layerService.findGroupById(groupId);
                if (group === null) {
                    let title = task.input.ensemble + ': ' + task.input.simulation;
                    group = this.createGroup(groupId, title);
                }

                // Add the data as a layer
                let layerId = task._id + '_' + name;
                if (!this.layerService.findLayer(layerId)) {
                    let layerDescription: ILayerDescription = {
                        id: layerId,
                        title: name,
                        type: 'geojson',
                        url: url,
                        timeAware: false,
                        opacity: 75,
                    };
                    if (task.typeUrl) {
                        layerDescription.typeUrl = task.typeUrl;
                    }
                    if (task.defaultFeatureType) {
                        layerDescription.defaultFeatureType = task.defaultFeatureType;
                    }
                    let newLayer = this.createLayer(layerDescription, group);

                    this.messageBusService.publish('layer', 'initialized', newLayer);
                    this.messageBusService.notify('Result added', 'Results from file <b>' + name +
                        '</b> added to layer in layer group <b>' + group.title + '</b>',
                        undefined, NotifyType.Success);
                } else {
                    this.messageBusService.notify('Result already available', 'Results from file <b>' +
                        name + '</b> are already available in layer group <b>' +
                        group.title + '</b>', undefined, NotifyType.Success);
                }
            });
        }

        public createGroup(groupId: string, title: string) : ProjectGroup {
            let newGroup = new ProjectGroup();
            newGroup.id = groupId;
            newGroup.title = title;
            newGroup.languages = {
                'en': {
                    'title': title,
                    'description': 'Layers added for ' + title
                }
            };
            newGroup.clustering = false;

            let group = ProjectGroup.deserialize(newGroup);

            this.layerService.project.groups.push(group);
            this.layerService.initGroup(group);

            return group;
        }

        public createLayer(layerDescription: ILayerDescription, group: ProjectGroup): ProjectLayer {
            let newLayer : ProjectLayer = $.extend(new ProjectLayer(), layerDescription);

            this.layerService.initLayer(group, newLayer);
            group.layers.push(newLayer);

            this.messageBusService.publish('layer', 'created', newLayer);

            return newLayer;
        }

        public visualizeInput(task: ITask) {
            this.SimSchemaService.getSchema({
                layer: (formItem, _schemaItem, schema) => {
                    let featureId = formItem.featureId;
                    let key = formItem.key;
                    let layerId = 'input-' + task._id + '-' + key;

                    let groupId = task.input.ensemble + '_' + task.input.simulation;
                    let group = this.layerService.findGroupById(groupId);
                    if (group === null) {
                        let title = task.input.ensemble + ': ' + task.input.simulation;
                        group = this.createGroup(groupId, title);
                    }

                    if (task.input.hasOwnProperty(key)) {
                        let layer = this.layerService.findLayer(layerId);
                        if (!layer) {
                            let layerDescription : ILayerDescription = {
                                id: layerId,
                                title: layerId,
                                type: 'geojson',
                                typeUrl: task.typeUrl,
                                defaultFeatureType: task.defaultFeatureType,
                                timeAware: false,
                                opacity: 75,
                            };
                            layer = this.createLayer(layerDescription, group);
                        }
                        layer.data = {
                            type: 'featureCollection',
                            features: [],
                        };
                        layer.typeUrl = schema.resourceTypeUrl;
                        task.input[key].forEach(feature => {
                            let f = {
                                type: 'Feature',
                                id: feature.id,
                                geometry: {
                                    type: 'Point',
                                    coordinates: [
                                        feature.x, feature.y
                                    ]
                                },
                                properties: {
                                    Name: feature.name,
                                    featureTypeId: featureId
                                }
                            };

                            layer.data.features.push(f);
                        });
                    }
                }
            });

        }
    }

    angular
        .module('csWebApp')
        .service('SimWebService', SimWebService);
}
