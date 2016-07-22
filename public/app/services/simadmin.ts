module App {
    export interface ISimAdminParameters {
        webserviceUrl: string;
        simulationName: string;
        simulationVersion: string;
    }

    export interface SimAdminMessage {
        simulation: string;
        version: string;
    }

    export class SimProject extends csComp.Services.Project {
        simAdmin: ISimAdminParameters;
    }

    export class SimAdminService {
        public webserviceUrl;
        public simulationName;
        public simulationVersion;
        private deferredWebserviceUrl: ng.IDeferred<string>;

        $inject = ['messageBusService', '$q'];

        constructor (private messageBusService: csComp.Services.MessageBusService, private $q: ng.IQService) {
            this.deferredWebserviceUrl = $q.defer();
            this.messageBusService.subscribe('project', (title: string, project: SimProject) => {
                if (title === 'loaded') {
                    this.webserviceUrl = project.simAdmin.webserviceUrl;
                    this.simulationName = project.simAdmin.simulationName;
                    this.simulationVersion = project.simAdmin.simulationVersion;

                    this.deferredWebserviceUrl.resolve(this.webserviceUrl);

                    let simAdminMessage:SimAdminMessage =  {
                        'simulation': this.simulationName, 'version': this.simulationVersion
                    };
                    this.messageBusService.publish('sim-admin', 'simulation-changed', simAdminMessage);
                }
            });
        }

        public getWebserviceUrl(): ng.IPromise<string> {
            return this.deferredWebserviceUrl.promise;
        }
    }

    angular
        .module('csWebApp')
        .service('SimAdminService', SimAdminService);
}
