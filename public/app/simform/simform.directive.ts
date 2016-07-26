module App {
    // var scripts = document.getElementsByTagName("script")
    // var currentScriptPath = scripts[scripts.length-1].src;

    import NotifyType = csComp.Services.NotifyType;
    import IFeature = csComp.Services.IFeature;
    import MessageBusHandle = csComp.Services.MessageBusHandle;
    import ICustomTypeParser = App.ICustomTypeParser;
    import StringMap = App.StringMap;
    import ProjectLayer = csComp.Services.ProjectLayer;
    import IWidget = csComp.Services.IWidget;

    /**
     * Define sim-form directive.
     *
     * This directive allows the user to specify the parameters of a simulation
     * and submit the task to the sim-city-webservice
     *
     * The directive requires a url for the webservice, a simulation name and a
     * simulation version.
     *
     * If admin mode is enabled the user is able to change the simulation name
     * and version
     *
     * @depends: json-schema-form
     */
    angular
        .module('csWebApp')
        .directive('simForm', [function (): ng.IDirective {
            return {
                // templateUrl: currentScriptPath.replace('directive.js', 'directive.html'),  // Dev code
                templateUrl: 'app/simform/simform.directive.html',
                restrict: 'E',
                scope: {
                    layerGroup: '@layerGroup',
                    formId: '@formId'
                },
                controller: SimFormController,
                controllerAs: 'vm',
                bindToController: true
            };
        }]);

    /**
     * Extension of the standard angular scope with our controller
     */
    export interface ISimFormScope extends ng.IScope {
        vm:SimFormController;
    }

    /**
     * The SimFormController controls The simulation submition form for the parameters and submitting a task.
     *    This form is generated using angular-json-schema-form from the json description
     *    provided by the sim-city-webservice.
     */
    export class SimFormController {
        /**
         * Directive parameters
         */
        private subscriptions: MessageBusHandle[];
        private layerGroup: string;
        private formLayers: string[];
        private widget: IWidget;

        /**
         * The schema, and form for simulation submision
         * and the corresonding model
         */
        private schema: IJsonSchema;
        private form: IAngularForm;
        private model: any;

        /**
         * Custom type handlers
         */
        private featureSubscriptions: MessageBusHandle[];
        private customTypeParsers: StringMap<ICustomTypeParser>;

        public static $inject = ['$scope', '$log', '$q', 'SimAdminService', 'SchemaService', 'SimWebService', 'messageBusService', 'layerService'];

        constructor(private $scope: ISimFormScope,
                    private $log: ng.ILogService,
                    private $q: ng.IQService,
                    private SimAdminService: App.SimAdminService,
                    private SchemaService: App.SchemaService,
                    private SimWebService: App.SimWebService,
                    private messageBusService: csComp.Services.MessageBusService,
                    private layerService: csComp.Services.LayerService) {

            var parameters: any = {};
            if ($scope.$parent.hasOwnProperty('widget')) {
                if ($scope.$parent['widget'].hasOwnProperty('data')) {
                    parameters = $scope.$parent['widget']['data'];
                }

                // If we are embedded as a widget, this is set.
                this.widget = $scope.$parent['widget'];
            }
            if (!this.layerGroup) {
                if (parameters.hasOwnProperty('layerGroup')) {
                    this.layerGroup = parameters.layerGroup;
                } else {
                    $log.warn('SimCityDirective.FormController: No layerGroup defined using SimCity');
                    this.layerGroup = 'SimCity';
                }
            }

            // Initialize the simulation form
            this.schema = {};
            this.form = [];
            this.model = {};
            this.featureSubscriptions = [];
            this.formLayers = [];

            // Initialize custom type mapping BEFORE getting
            // the simulation form
            this.initializeCustomTypes();

            this.subscriptions = [];
            this.subscriptions.push(this.messageBusService.subscribe('sim-admin', (title: string, data?: any): void => {
                if (title === 'simulation-changed') {
                    this.simulationChanged();
                }
            }));

            this.subscriptions.push(this.messageBusService.subscribe('sim-admin', (title: string, data?: any): void => {
                if (title === 'simulation-changed') {
                    this.simulationChanged();
                }
            }));

            $scope.$on('$destroy', () => {
                this.stop();
            });

            this.simulationChanged();
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
         * Submit the simulation from to the webservice
         */
        public onSubmit(form: any) {
            // Check if the form is valid
            if (form.$valid) {
                this.SimWebService.submit(this.SimAdminService.simulationName,
                                          this.SimAdminService.simulationVersion,
                                          this.model)
                    .then(() => {
                            this.messageBusService.publish('sim-task', 'submitted');
                            this.messageBusService.notify('New simulation', 'Submitted simulation',
                                undefined, NotifyType.Success);
                            this.toggleWidget();
                        }, message => {
                            this.messageBusService.notify('New simulation', 'Failed to submit simulation: '
                                + message.message, undefined, NotifyType.Error);
                        });
            } else {
                this.messageBusService.notify('New simulation', 'Form invalid! It has not been submitted!',
                    undefined, NotifyType.Error);
            }
        }

        /**
         * Cancel the form.
         */
        public cancel() {
            this.toggleWidget();
            this.messageBusService.publish('sim-task', 'cancelled');
        }

        public toggleWidget() {
            if (this.widget) {
                this.widget.collapse = !this.widget.collapse;
            }
        }

        /**
         * Reset the simulation form
         */
        private resetForm(): void {
            this.featureSubscriptions.forEach(handle => {
                this.messageBusService.unsubscribe(handle);
            });
            this.featureSubscriptions = [];
            this.form = [];
            this.schema = {};
            this.model = {};
        }

        /**
         * Get the simulation form from the webservice.
         */
        private getForm(): ng.IPromise<void> {
            return this.SchemaService.getSchema(this.customTypeParsers)
                .then((data) => {
                    if (data != null) {
                        this.schema = data.schema;
                        this.form = data.form;

                        this.$scope.$broadcast('schemaFormValidate');
                    } else {
                        this.resetForm();
                        this.messageBusService.notifyError('No valid form', 'The webservice did not return a valid form for this simulation: ' +
                                                            this.SimAdminService.simulationName + '@' +
                                                            this.SimAdminService.simulationVersion);
                    }
                });
        }

        /**
         * Initializing custom type handlers.
         *
         * These handlers are used called when a schema is parsed
         */
        private initializeCustomTypes(): void {
            this.customTypeParsers = {
                point2d: (formItem, _schemaItem): void => {
                    // A point2d is a cartesian coordinate point on the map
                    formItem.type = 'template';
                    formItem.template =
                        '<div ng-if="item.id">{{item.id}}</div>' +
                        '<div ng-if="!item.id">({{item.x}}, {{item.y}})</div>';
                },
                layer: (formItem, _schemaItem) => {
                    // A layer schema element means the parameter requires
                    // specific features from the map (typically a point2d)
                    formItem.type = 'array';

                    let layerId = formItem.layer;
                    let featureId = formItem.featureId;
                    let key = formItem.key;

                    // Check if layer exists, and if not create it.
                   this.checkAndCreateLayer(layerId);

                    // Subscribe to feature update messages
                    let subscription = this.messageBusService.subscribe('feature', (title: string, feature: IFeature) => {
                        // We respond to additions, updates and removals
                        let supportedOps = ['dropped', 'onFeatureUpdated', 'onFeatureRemoved'];

                        // Only respond to the right layer and feature type
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

                            // Update the model
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
                    this.featureSubscriptions.push(subscription);
                }
            };
        }

        // Functions the controller exposes

        /**
         * The simulation has changed.
         *
         * Update the schema, form and model
         */
        public simulationChanged = (): void => {
            this.resetForm();
            this.resetLayers();
            this.getForm().then(() => {
                this.removeExcessLayers();
            });
        };

        /**
         * Helper function to find the object index in the model of a feature
         */
        private indexOfFeature(key: string, id: string): ng.IPromise<number> {
            let index = this.model[key].map(f => f.id).indexOf(id);
            return this.$q((resolve, reject) => (index >= 0 ? resolve(index) : reject()));
        }

        private resetLayers() {
            let group = this.layerService.findGroupById(this.layerGroup);
            group.layers.forEach((layer: csComp.Services.IProjectLayer) => {
                // unfortunately there is no reset layer function
                layer.data.features.forEach(f => layer.layerSource.service.removeFeature(f));
            });
            this.formLayers = [];
        }

        /**
         * Check if the specified layer exists, and if it doesn't, create it.
         */
        private checkAndCreateLayer(layerId: string) {
            let layer = this.layerService.findLayer(layerId);
            if (!layer) {
                layer = new ProjectLayer();
                let group = this.layerService.findGroupById(this.layerGroup);

                layer.id = layerId;
                layer.type = 'editablegeojson';
                layer.renderType = 'geojson';
                layer.typeUrl = '/explore/resource/matsim';
                // For some reason using .timeAware gives an error when compiling
                layer.timeAware = false;
                layer.data = {
                    'type': 'FeatureCollection',
                    'properties': {},
                    'features': []
                };

                this.layerService.initLayer(group, layer);
                group.layers.push(layer);

                this.messageBusService.publish('layer', 'created', layer);
            }
            // remember that we need this layer
            this.formLayers.push(layer.id);
        }

        private removeExcessLayers() {
            let group = this.layerService.findGroupById(this.layerGroup);
            if (group) {
                group.layers.forEach((layer: ProjectLayer) => {
                    if (this.formLayers.indexOf(layer.id) === -1) {
                        this.layerService.removeLayer(layer, true);
                    }
                });
            }
        }
    }
}
