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

        $inject = ['messageBusService'];

        constructor (private messageBusService) {
            this.messageBusService.subscribe('project', (topic: string, project: SimProject) => {
                if (topic === 'loaded') {
                    this.webserviceUrl = project.simAdmin.webserviceUrl;
                    this.simulationName = project.simAdmin.simulationName;
                    this.simulationVersion = project.simAdmin.simulationVersion;

                    let simAdminMessage:SimAdminMessage =  {
                        'simulation': this.simulationName, 'version': this.simulationVersion
                    };
                    this.messageBusService.publish('sim-admin', 'simulation-changed', simAdminMessage);
                }
            });
        }
    }

    angular
        .module('csWebApp')
        .service('SimAdminService', SimAdminService);
}
