module App {

    export interface ISimWebSimulation {
        name: string;
        versions: string[];
    }
    export interface ISimWebSimulations {
        [key: string]: ISimWebSimulation;
    }

    export interface ISimWebSummary {
        tasks: {name: string, value: number}[];
        jobs: {name: string, value: number}[];
    }

    export class SimWebService {
        public static $inject = ['$http', '$q'];

        private simulationsCache: StringMap<ISimWebSimulations>;

        constructor(private $http: ng.IHttpService, private $q: ng.IQService) {
            this.simulationsCache = {};
        }

        public list(webserviceUrl: string, simulation: string, version: string): ng.IHttpPromise<any> {
            return this.$http.get(webserviceUrl + '/view/simulations/' + simulation + '/' + version);
        }

        public get(webserviceUrl: string, id: string): ng.IHttpPromise<any> {
            return this.$http.get(webserviceUrl + '/simulation/' + id);
        }

        public startJob(webserviceUrl: string, host: string): ng.IPromise<any> {
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

        public submit(webserviceUrl: string, model: string, version: string, params: any): ng.IPromise<{name: string, url: string}> {
            var url = webserviceUrl + '/simulate/' + model;
            if (version) {
                url += '/' + version;
            }
            return this.http('POST', url, params)
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

        public delete(webserviceUrl: string, id: string, rev: string): ng.IHttpPromise<any> {
            return this.http('DELETE', webserviceUrl + '/simulation/' + id, {rev: rev});
        }


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
                    return this.$q.reject('Cannot load infrastructure overview ' + status);
                });
        }

        private http(method: string, url: string, params: any): ng.IHttpPromise<any> {
            return this.$http({
                method: method,
                url: url,
                params: params,
                headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'}
            });
        }

        private static formatHTTPError(data: any, status: number, statusText: string, defaultMsg: string): any {
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
