module App {
    import Expertise = csComp.Services.Expertise;
    import MessageBusHandle = csComp.Services.MessageBusHandle;


    angular
        .module('csWebApp')
        .directive('simAdmin', [function (): ng.IDirective {
            return {
                // templateUrl: currentScriptPath.replace('directive.js', 'directive.html'),  // Dev code
                templateUrl: 'app/simadmin/simadmin.directive.html',
                restrict: 'E',
                scope: {
                    webserviceUrl: '@simWebserviceUrl'
                },
                controller: SimAdminController,
                controllerAs: 'vm',
                bindToController: true
            };
        }]);

    /**
     * Extension of the standard angular scope with our controller
     */
    export interface ISimAdminScope extends ng.IScope {
        vm: SimAdminController;
    }

    export interface ISimAdminParameters {
        webserviceUrl: string;
    }

    /**
     * The SimFormController controls the admin form to change the simulation and version,
     * this is only visible if admin mode is on.
     */
    export class SimAdminController {
        /**
         * Directive parameters
         */
        private simulation: string;
        private version: string;
        private webserviceUrl: string;
        private parameters: ISimAdminParameters;
        private subscriptions: MessageBusHandle[];

        /**
         * Admin form
         */
        private hideAdminForm;
        private versionOptions: string[];
        private simulationOptions: string[];

        public static $inject = ['$scope', '$log', 'SchemaService', 'SimWebService', 'messageBusService', 'mapService'];

        constructor(private $scope: ISimAdminScope,
                    private $log: ng.ILogService,
                    private SchemaService: App.SchemaService,
                    private SimWebService: App.SimWebService,
                    private messageBusService: csComp.Services.MessageBusService,
                    private mapService: csComp.Services.MapService) {

            if ($scope.$parent.hasOwnProperty('widget') && $scope.$parent['widget'].hasOwnProperty('parameters')) {
                this.parameters = $scope.$parent['widget']['parameters'];
            }

            if (!this.webserviceUrl) {
                if (this.parameters.hasOwnProperty('webserviceUrl')) {
                    this.webserviceUrl = this.parameters.webserviceUrl;
                } else {
                    $log.error('SimCityDirective.SimListController: no URL provided');
                    return;
                }
            }

            // Add this controller to the angular scope
            this.$scope.vm = this;

            // Initialize the admin form
            this.hideAdminForm = true;
            this.versionOptions = [];
            this.simulationOptions = [];
            if (mapService.expertMode >= Expertise.Admin) {
                this.enableExpertMode();
            }

            // Subscribe to changes in admin status
            this.subscriptions = [];
            this.subscriptions.push(this.messageBusService.subscribe('expertMode', (title: string, expertMode: Expertise) => {
                if (title === 'newExpertise') {
                    if (mapService.expertMode >= Expertise.Admin) {
                        this.enableExpertMode();
                    } else {
                        this.hideAdminForm = true;
                    }
                }
            }));
        }

        /**
         * When the widget is stopped, unsubscribe from the messageBusService
         *
         * The widget is stopped when the dashboard is switched
         */
        public stop() {
            this.subscriptions.forEach((handle: MessageBusHandle) => {
                this.messageBusService.unsubscribe(handle);
            });
            this.subscriptions = [];
        }

        /**
         * Enable the admin form
         */
        private enableExpertMode():void {
            this.hideAdminForm = false;

            if (this.simulationOptions.length === 0) {
                this.SimWebService.simulations(this.webserviceUrl)
                    .then((data) => {
                        this.simulationOptions = Object.keys(data);
                        if (this.simulation && this.simulation in data) {
                            this.versionOptions = data[this.simulation].versions;
                        }
                    });
            }
        }

        /**
         * The simulation has been changed using the admin form.
         *
         * Populate the version select
         */
        public simulationChanged(): void {
            this.SimWebService.simulations(this.webserviceUrl).then(data => {
                this.versionOptions = data[this.simulation].versions;
            });
        }

        /**
         * The simulation version has changed.
         *
         * Update the schema, form and model
         */
        public simulationVersionChanged(): void {
            this.messageBusService.publish('sim-admin', 'simulation-changed', {'simulation': this.simulation, 'version': this.version});
        }
    }
}