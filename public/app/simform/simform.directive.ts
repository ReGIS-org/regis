module App {
    // var scripts = document.getElementsByTagName("script")
    // var currentScriptPath = scripts[scripts.length-1].src;

    import Expertise = csComp.Services.Expertise;
    import NotifyType = csComp.Services.NotifyType;
    import IFeature = csComp.Services.IFeature;
    import MessageBusHandle = csComp.Services.MessageBusHandle;
    import ICustomTypeParser = App.ICustomTypeParser;
    import StringMap = App.StringMap;

    angular
        .module('csWebApp')
        .directive('simForm', [function (): ng.IDirective {
            return {
                // templateUrl: currentScriptPath.replace('directive.js', 'directive.html'),  // Dev code
                templateUrl: 'app/simform/simform.directive.html',
                restrict: 'E',
                scope: {
                    webserviceUrl: '@simWebserviceUrl',
                    simulation: '@simName',
                    version: '@simVersion'
                },
                controller: SimFormController,
                controllerAs: 'vm',
                bindToController: true
            };
        }]);

    export interface ISimFormScope extends ng.IScope {
        vm:SimFormController;
    }

    class SimFormController {
        /**
         * Directive parameters
         */
        private simulation: string;
        private version: string;
        private versionOptions: string[];
        private simulationOptions: string[];
        private webserviceUrl: string;

        private schema: IJsonSchema;
        private form: IAngularForm;
        private model: any;

        /**
         * Custom type handlers
         */
        private featureUnSubscribe: MessageBusHandle[];
        private customTypeParsers: StringMap<ICustomTypeParser>;

        /**
         * Admin form
         */
        private hideSimulationForm;

        public static $inject = ['$scope', '$log', '$q', 'SchemaService', 'SimWebService', 'messageBusService', 'mapService'];

        constructor(private $scope: ISimFormScope,
                    private $log: ng.ILogService,
                    private $q: ng.IQService,
                    private SchemaService: App.SchemaService,
                    private SimWebService: App.SimWebService,
                    private messageBusService: csComp.Services.MessageBusService,
                    private mapService: csComp.Services.MapService) {

            if (!this.webserviceUrl) {
                $log.error('SimCityDirective.FormController: no URL provided');
                return;
            }

            // If not in expert mode or higher we need a simulation and version
            if (!this.simulation || !this.version) {
                $log.error('SimCityDirective.FormController: No simulation provided');
                return;
            }

            this.$scope.vm = this;

            this.hideSimulationForm = true;

            this.schema = {};
            this.form = [];
            this.model = {};

            this.initializeCustomTypes();
            this.versionOptions = [];
            this.simulationOptions = [];

            this.getForm(this.simulation, this.version);
            if (mapService.expertMode >= Expertise.Admin) {
                this.enableExpertMode();
            }

            this.messageBusService.subscribe('expertMode', (title: string, expertMode: Expertise) => {
                if (title !== 'newExpertise') return;
                if (mapService.expertMode >= Expertise.Admin) {
                    this.enableExpertMode();
                } else {
                    this.hideSimulationForm = true;
                }
            });
        }

        public onSubmit(form: any) {
            // Then we check if the form is valid
            if (form.$valid) {
                this.SimWebService.submit(this.webserviceUrl,
                                          this.simulation,
                                          this.version,
                                          this.model)
                    .then(() => {
                            this.messageBusService.publish('sim-task', 'submitted');
                            this.messageBusService.notify('New simulation', 'Submitted simulation',
                                undefined, NotifyType.Success);
                        }, message => {
                            this.messageBusService.notify('New simulation', 'Failed to submit simulation: '
                                + message.message, undefined, NotifyType.Error);
                        });
            } else {
                this.messageBusService.notify('New simulation', 'Form invalid! It has not been submitted!',
                    undefined, NotifyType.Error);
            }
        }

        private resetForm(): void {
            this.featureUnSubscribe.forEach(handle => {
                this.messageBusService.unsubscribe(handle);
            });
            this.featureUnSubscribe = [];
            this.form = [];
            this.schema = {};
        }

        private getForm(simulation, value): void {
            this.SchemaService.getSchema(this.webserviceUrl,
                simulation, value,
                this.customTypeParsers).then(
                    data => {
                        this.schema = data.schema;
                        this.form = data.form;

                        this.$scope.$broadcast('schemaFormValidate');
                    });
        }

        private initializeCustomTypes(): void {
            this.featureUnSubscribe = [];
            this.customTypeParsers = {
                point2d: (formItem, _schemaItem): void => {
                    formItem.type = 'template';
                    formItem.template =
                        '<div ng-if="item.id">{{item.id}}</div>' +
                        '<div ng-if="!item.id">({{item.x}}, {{item.y}})</div>';
                },
                layer: (formItem, _schemaItem) => {
                    formItem.type = 'array';

                    let layerId = formItem.layer;
                    let featureId = formItem.featureId;
                    let key = formItem.key;

                    let unSubscribe = this.messageBusService.subscribe('feature', (title: string, feature: IFeature) => {
                        let supportedOps = ['dropped', 'onFeatureUpdated', 'onFeatureRemoved'];

                        if (feature && layerId === feature.layerId && featureId === feature.properties['featureTypeId']
                            && supportedOps.indexOf(title) >= 0) {
                            let value = {
                                id: feature.properties['Name'],
                                x: feature.geometry.coordinates[0],
                                y: feature.geometry.coordinates[1]
                            };

                            // make sure the key is in the model
                            // we cannot do this earlier, or validation will fail.
                            if (!this.model.hasOwnProperty(key)) {
                                this.model[key] = [];
                            }

                            switch (title) {
                                case 'dropped':
                                    this.model[key].push(value);
                                    break;
                                case 'onFeatureUpdated':
                                    this.indexOfFeature(key, value.id)
                                        .then(i => this.model[key][i] = value,
                                              () => this.model[key].push(value));
                                    break;
                                case 'onFeatureRemoved':
                                    this.indexOfFeature(key, value.id)
                                        .then(i => this.model[key].splice(i, 1));
                                    break;
                            }

                            if (this.model[key].length === 0) {
                                delete this.model[key];
                            }
                        }
                    });
                    this.featureUnSubscribe.push(unSubscribe);
                }
            };
        }

        private enableExpertMode():void {
            this.hideSimulationForm = false;

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

        // Functions the controller exposes
        public simulationChanged(): void {
            this.resetForm();
            this.SimWebService.simulations(this.webserviceUrl).then(data => {
                this.versionOptions = data[this.simulation].versions;
            });
        }

        public simulationVersionChanged(): void {
            this.resetForm();
            this.getForm(this.simulation, this.version);
        }

        private indexOfFeature(key: string, id: string): ng.IPromise<number> {
            let index = this.model[key].map(f => f.id).indexOf(id);
            return this.$q((resolve, reject) => (index >= 0 ? resolve(index) : reject()));
        }
    }
}
