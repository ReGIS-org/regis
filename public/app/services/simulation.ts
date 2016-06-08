module App {

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
        id?: string;
        rev?: string;
        _id?: string;
        _rev?: string;
        url?: string;
        lock: number;
        done: number;
        error: any[];
        input: {
            simulation: string;
            ensemble: string;
            [key: string]: any;
        };
        output?: any;
        uploads?: { [key: string]: string };
        _attachments?: { [key: string]: any };
        hostname?: string;
        name?: string;
        ensemble?: string;
        scrub_count?: number;
        type?: string;
        version?: string;
        command?: string;
        arguments?: string;
    }

    /**
     * Interface to the SIM-CITY webservice.
     *
     * All methods take a webservice base URL.
     */
    export class SimWebService {
        public static $inject = ['$http', '$q'];

        private simulationsCache: StringMap<ISimWebSimulations>;

        constructor(private $http: ng.IHttpService, private $q: ng.IQService) {
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
        public submit(webserviceUrl: string, model: string, version: string, params: any): ng.IPromise<{name: string, url: string}> {
            var url = webserviceUrl + '/simulate/' + model;
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
    }

    angular
        .module('csWebApp')
        .service('SimWebService', SimWebService);
}
