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
                templateUrl: 'app/simform/simform.directive.html',
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
        private featureUnSubscribe: MessageBusHandle[];
        private schema: IJsonSchema;
        private form: IAngularForm;
        private model: any;
        private customTypeParsers: StringMap<ICustomTypeParser>;
        private simulationOptions: {label: string, value: string}[];
        private versionOptions: {label: string, value: string}[];
        private simulationSelected;
        private webserviceUrl: string;

        public static $inject = ['$scope', '$log', '$q', 'SchemaService', 'SimWebService', 'messageBusService'];

        constructor(private $scope: ng.IScope,
                    private $log: ng.ILogService,
                    private $q: ng.IQService,
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

                    let layerId = formItem.layer;
                    let featureId = formItem.featureId;
                    let key = formItem.key;

                    // make sure the key is in the model
                    if (!this.model.hasOwnProperty(key)) {
                        this.model[key] = [];
                    }

                    let unSubscribe = this.messageBusService.subscribe('feature', (title: string, feature: IFeature) => {
                        let supportedOps = ['dropped', 'onFeatureUpdated', 'onFeatureRemoved'];

                        if (feature && layerId === feature.layerId && featureId === feature.properties['featureTypeId']
                            && supportedOps.indexOf(title) >= 0) {
                            let value = {
                                id: feature.properties['Name'],
                                x: feature.geometry.coordinates[0],
                                y: feature.geometry.coordinates[1]
                            };

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
                    let sim = data[this.simulationSelected.simulation.value];
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
                            this.messageBusService.notify('New simulation', 'Failed to submit simulation: '
                                + message.message, undefined, NotifyType.Error);
                        });
            } else {
                this.messageBusService.notify('New simulation', 'Form invalid! It has not been submitted!',
                    undefined, NotifyType.Success);
            }
        }

        private indexOfFeature(key: string, id: string): ng.IPromise<number> {
            let index = this.model[key].map(f => f.id).indexOf(id);
            return this.$q((resolve, reject) => (index >= 0 ? resolve(index) : reject()));
        }
    }
}
