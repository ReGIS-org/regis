module App {
    // var scripts = document.getElementsByTagName("script")
    // var currentScriptPath = scripts[scripts.length-1].src;

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
                templateUrl: 'app/components/sim-city/simform.directive.html',
                restrict: 'E',
                scope: {
                    webserviceUrl: '@simWebserviceUrl',
                },
                controller: SimFormController,
                controllerAs: 'vm',
                bindToController: true
            };
        }]);


    class SimFormController {

        public static $inject = ['$scope', '$timeout', '$log', 'SchemaService', 'SimWebService', 'messageBusService'];

        private featureUnSubscribe: MessageBusHandle[];
        private schema: IJsonSchema;
        private form: IAngularForm;
        private model: any;
        private customTypeParsers: StringMap<ICustomTypeParser>;
        private simulationOptions: {label: string, value: string}[];
        private versionOptions: {label: string, value: string}[];
        private simulationSelected;
        private webserviceUrl: string;

        constructor(private $scope: ng.IScope,
                    private $log: ng.ILogService,
                    private SchemaService: App.SchemaService,
                    private SimWebService: App.SimWebService,
                    private messageBusService: csComp.Services.MessageBusService) {
            if (!this.webserviceUrl) {
                $log.error('SimCityDirective.FormController: no URL provided');
                return;
            }
            this.SimWebService.simulations(this.webserviceUrl)
                .then((data) => {
                    this.simulationOptions = Object.keys(data).map((item: string) => {
                        return {
                            label: item,
                            value: item
                        };
                    });
                });

            this.schema = {};
            this.form = [];
            this.model = {};
            this.simulationOptions = [];
            this.versionOptions = [];
            this.featureUnSubscribe = [];
            this.simulationSelected = {
                simulation: {},
                version: {}
            };

            this.customTypeParsers = {
                point2d: (formItem, _schemaItem, _form): void => {
                    formItem.type = 'template';
                    formItem.template =
                        '<div ng-if="item.id">{{item.id}}</div>' +
                        '<div ng-if="!item.id">({{item.x}}, {{item.y}})</div>';
                },
                layer: (formItem, _schemaItem, _form) => {
                    formItem.type = 'array';

                    var layerId = formItem.layer;
                    var featureId = formItem.featureId;
                    var key = formItem.key;

                    var unSubscribe = this.messageBusService.subscribe('feature', (title: string, feature: IFeature) => {
                        var supportedOps = ['dropped', 'onFeatureUpdated', 'onFeatureRemoved'];

                        if (feature && layerId === feature.layerId && featureId === feature.properties['featureTypeId']
                            && supportedOps.indexOf(title) >= 0) {
                            var value = {
                                id: feature.properties['Name'],
                                x: feature.geometry.coordinates[0],
                                y: feature.geometry.coordinates[1]
                            };

                            switch (title) {
                                case 'dropped':
                                    if (key in this.model) {
                                        this.model[key].push(value);
                                    } else {
                                        this.model[key] = [value];
                                    }
                                    break;
                                case 'onFeatureUpdated':
                                    if (key in this.model) {
                                        var index = this.model[key].map(f => f.id).indexOf(value.id);
                                        if (index >= 0) {
                                            this.model[key][index] = value;
                                        } else {
                                            this.model[key].push(value);
                                        }
                                    } else {
                                        this.model[key] = [value];
                                    }
                                    break;
                                case 'onFeatureRemoved':
                                    if (key in this.model) {
                                        var index = this.model[key].map(f => f.id).indexOf(value.id);
                                        if (index >= -1) {
                                            this.model[key].splice(index, 1);
                                        }
                                    }
                                    break;
                            }
                        }
                    });
                    this.featureUnSubscribe.push(unSubscribe);
                }
            };
        }


        // Functions the controller exposes

        // Initialize controller
        // the vm.simulationurl should already be set by angular
        // try {
        //   vm.simulationurl = $scope.$parent.widget.data.schemaurl;
        // } catch(e) {
        //   // Do nothing...
        // }

        // Add the model of this form to the schema service so it can be updated
        private resetForm(): void {
            this.featureUnSubscribe.forEach(handle => {
                this.messageBusService.unsubscribe(handle);
            });
            this.featureUnSubscribe = [];
            this.form = [];
            this.schema = {};
        }

        public simulationChanged(): void {
            if (this.simulationSelected.simulation.value) {
                this.resetForm();
                this.SimWebService.simulations(this.webserviceUrl).then((data) => {
                    var sim = data[this.simulationSelected.simulation.value];
                    this.versionOptions = sim.versions.map((version: string) => {
                        return {
                            label: version,
                            value: version
                        };
                    });
                });
            }
        }

        public simulationVersionChanged(): void {
            if (this.simulationSelected.version.value) {
                this.resetForm();
                this.SchemaService.getSchema(this.webserviceUrl,
                    this.simulationSelected.simulation.value,
                    this.simulationSelected.version.value,
                    this.customTypeParsers).then(
                        data => {
                            this.schema = data.schema;
                            this.form = data.form;

                            this.$scope.$broadcast('schemaFormValidate');
                        });
            }
        }

        public onSubmit(form: any) {
            // Then we check if the form is valid
            if (form.$valid) {
                this.SimWebService.submit(this.webserviceUrl,
                                          this.simulationSelected.simulation.value,
                                          this.simulationSelected.version.value,
                                          this.model)
                    .then(() => {
                            this.messageBusService.notify('New simulation', 'Submitted simulation',
                                undefined, NotifyType.Success);
                        }, message => {
                            this.messageBusService.notify('New simulation', 'Failed to submit simulation: ' + message,
                                undefined, NotifyType.Error);
                        });
            } else {
                this.messageBusService.notify('New simulation', 'Form invalid! It has not been submitted!',
                    undefined, NotifyType.Success);
            }
        }
    }
}
