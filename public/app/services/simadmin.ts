module App {
    export interface ISimAdminParameters {
        webserviceUrl: string;
        simulationName: string;
        simulationVersion: string;
        layerGroup: string;
    }

    export interface SimAdminMessage {
        simulation: string;
        version: string;
    }

    export class SimProject extends csComp.Services.Project {
        simAdmin: ISimAdminParameters;
    }

    export class SimAdminService {
        public simulationName;
        public simulationVersion;
        public layerGroup: string;

        private webserviceUrl;
        private deferredWebserviceUrl: ng.IDeferred<string>;

        $inject = ['messageBusService', '$q', '$log'];

        constructor (private messageBusService: csComp.Services.MessageBusService,
                     private $q: ng.IQService,
                     $log: ng.ILogService) {
            this.deferredWebserviceUrl = this.$q.defer();
            this.messageBusService.subscribe('project', (title: string, project: SimProject) => {
                if (title === 'loaded') {
                    if (!project.hasOwnProperty('simAdmin')) {
                        $log.error('simAdmin not set in project.json');
                        this.deferredWebserviceUrl.reject();
                    } else if (!project.simAdmin.hasOwnProperty('webserviceUrl') ||
                               !project.simAdmin.hasOwnProperty('simulationName') ||
                               !project.simAdmin.hasOwnProperty('simulationVersion') ||
                               !project.simAdmin.hasOwnProperty('layerGroup')) {
                        $log.error('Not all properties set in simAdmin in project.json');
                        this.deferredWebserviceUrl.reject();
                    } else {
                        this.webserviceUrl = project.simAdmin.webserviceUrl;
                        this.deferredWebserviceUrl.resolve(this.webserviceUrl);
                        this.setSimulationVersion(project.simAdmin.simulationName, project.simAdmin.simulationVersion);
                        this.layerGroup = project.simAdmin.layerGroup;
                    }
                }
            });
        }

        public getWebserviceUrl = (): ng.IPromise<string> => {
            if (typeof this.webserviceUrl === 'undefined') {
                return this.deferredWebserviceUrl.promise;
            } else {
                return this.$q.resolve(this.webserviceUrl);
            }
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
        .service('simAdminService', SimAdminService);
}
