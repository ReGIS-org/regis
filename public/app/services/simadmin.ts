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
        private webserviceUrl;
        public simulationName;
        public simulationVersion;
        private deferredWebserviceUrl: ng.IDeferred<string>;

        $inject = ['messageBusService', '$q'];

        constructor (private messageBusService: csComp.Services.MessageBusService, private $q: ng.IQService) {
            this.deferredWebserviceUrl = $q.defer();
            this.messageBusService.subscribe('project', (title: string, project: SimProject) => {
                if (title === 'loaded') {
                    this.webserviceUrl = project.simAdmin.webserviceUrl;
                    this.deferredWebserviceUrl.resolve(this.webserviceUrl);
                    this.setSimulationVersion(project.simAdmin.simulationName, project.simAdmin.simulationVersion);
                }
            });
        }

        public getWebserviceUrl(): ng.IPromise<string> {
            return this.deferredWebserviceUrl.promise;
        }
        /**
         * The simulation version has changed.
         *
         * Update the schema, form and model
         */
        public setSimulationVersion(simulation: string, version: string): void {
            this.simulationName = simulation;
            this.simulationVersion = version;

            this.messageBusService.publish('sim-admin', 'simulation-changed', {
                'simulation': this.simulationName,
                'version': this.simulationVersion
            });
        }
    }

    angular
        .module('csWebApp')
        .service('SimAdminService', SimAdminService);
}
