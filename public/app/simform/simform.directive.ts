module App {
    // var scripts = document.getElementsByTagName('script')
    // var currentScriptPath = scripts[scripts.length-1].src;

    import NotifyType = csComp.Services.NotifyType;
    import IFeature = csComp.Services.IFeature;
    import MessageBusHandle = csComp.Services.MessageBusHandle;
    import ICustomTypeParser = App.ICustomTypeParser;
    import StringMap = App.StringMap;
    import ProjectLayer = csComp.Services.ProjectLayer;
    import IButton = ButtonWidget.IButton;

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

    export interface ICreateLayerDescription {
        layerId: string;
        layerTitle: string;
        typeUrl: string;
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
        private formLayers: string[];

        /**
         * The schema, and form for simulation submision
         * and the corresonding model
         */
        private schema: IJsonSchema;
        private form: IAngularForm;
        private model: any;
        private legend: string;
        private buttons: IButton[];
        private layerLoaded: boolean;
        private _layer: csComp.Services.ProjectLayer;

        /**
         * Custom type handlers
         */
        private featureSubscriptions: MessageBusHandle[];
        private customTypeParsers: StringMap<ICustomTypeParser>;

        public static $inject = ['$scope', '$log', '$q', '$http',
                                 'simAdminService', 'schemaService',
                                 'simWebService', 'messageBusService',
                                 'layerService', '$sce', 'actionService'];

        constructor(private $scope: ISimFormScope,
                    private $log: ng.ILogService,
                    private $q: ng.IQService,
                    private $http: ng.IHttpService,
                    private simAdminService: App.SimAdminService,
                    private schemaService: App.SchemaService,
                    private simWebService: App.SimWebService,
                    private messageBusService: csComp.Services.MessageBusService,
                    private layerService: csComp.Services.LayerService,
                    private $sce: ng.ISCEService,
                    private actionService: csComp.Services.ActionService) {

            // Initialize the simulation form
            this.schema = {};
            this.form = [];
            this.model = {};
            this.featureSubscriptions = [];
            this.formLayers = [];
            this.legend = '';
            this.layerLoaded = false;


            this.initializeCustomTypes();

            this.subscriptions = [];
            this.subscriptions.push(this.messageBusService.subscribe('sim-admin', (title: string, data?: any): void => {
                if (title === 'simulation-changed') {
                    this.simulationChanged();
                }
            }));

            $scope.$on('$destroy', () => {
                this.stop();
            });
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
                this.simWebService.submit(this.simAdminService.simulationName,
                                          this.simAdminService.simulationVersion,
                                          this.model)
                    .then(() => {
                            this.messageBusService.publish('sim-task', 'submitted');
                            this.messageBusService.notify('New simulation', 'Submitted simulation',
                                undefined, NotifyType.Success);
                            this.resetForm();
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
            this.messageBusService.publish('sim-task', 'cancelled');
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
            this.legend = '';
        }

        /**
         * Get the simulation form from the webservice.
         */
        private getForm(): ng.IPromise<void> {
            return this.schemaService.getSchema(this.customTypeParsers)
                .then((data) => {
                    if (data != null) {
                        this.schema = data.schema;
                        this.form = data.form;
                        this.legend = data.schema.title;

                        this.$scope.$broadcast('schemaFormValidate');
                    } else {
                        this.resetForm();
                        this.messageBusService.notifyError('No valid form', 'The webservice did not return a valid form for this simulation: ' +
                                                            this.simAdminService.simulationName + '@' +
                                                            this.simAdminService.simulationVersion);
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
                    formItem.selectFeature = (featureId) => {
                        let feature = this.layerService.findFeatureById(featureId);
                        if (feature) {
                            this.layerService.selectFeature(feature, false, true);
                        }
                    };
                    formItem.template =
                        '<div>{{::item.name}}: ({{item.x | number:2}}, {{item.y | number:2}})</div>';
                },
                layer: (formItem, _schemaItem, schema) => {
                    // A layer schema element means the parameter requires
                    // specific features from the map (typically a point2d)
                    formItem.type = 'array';

                    let layerId, layerTitle, featureId, key;

                    if (formItem.layer) {
                        layerId = formItem.layer;
                    } else {
                        layerId = csComp.Helpers.getGuid();
                    }
                    if (formItem.layerTitle) {
                        layerTitle = formItem.layerTitle;
                    } else {
                        layerTitle = layerId;
                    }
                    if (!formItem.featureId) {
                        console.error('Could not find a feature id for layer' + layerTitle + ' aborting.');
                        return;
                    }
                    if (!formItem.key) {
                        console.error('Could not find the key for layer' + layerTitle + ' aborting.');
                        return;
                    }

                    featureId = formItem.featureId;
                    key = formItem.key;

                    // Check if layer exists, and if not create it.
                    let description = {
                        layerId: layerId,
                        layerTitle: layerTitle,
                        typeUrl: schema.resourceTypeUrl
                    };
                    this.checkAndCreateLayer(description);

                    // Subscribe to feature update messages
                    let subscription = this.messageBusService.subscribe('feature', (title: string, feature: IFeature) => {
                        // We respond to additions, updates and removals
                        let supportedOps = ['dropped', 'onFeatureUpdated', 'onFeatureRemoved'];

                        // Only respond to the right layer and feature type
                        if (feature && layerId === feature.layerId && featureId === feature.properties['featureTypeId']
                            && supportedOps.indexOf(title) >= 0) {
                            let value = {
                                id: feature.id,
                                name: feature.properties['Name'],
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
                },
                dataLayer: (formItem, _schemaItem, schema) => {
                  let key = formItem.key;
                  var g = this.layerService.findGroupById(_schemaItem.layerGroup);
                  formItem.type = 'template';
                  formItem.selectFeature = (item) => {
                      let layerUrl = this.model[item.key[0]]; // selected

                      this.$http({
                        method: 'get',
                        url: layerUrl,
                        cache: true
                      }).then(resp => {
                        var columns = new Set();
                        L.geoJson(resp.data, {
                          onEachFeature: (feature, layer) => {
                            for (var prop in feature.properties) {
                              columns.add(prop);
                            }
                          }
                        });
                        console.log('We want to load layer: ' + layerUrl);
                        console.log('  layer has these columns: ');
                        console.log(columns);
                        console.log('  we should choose one of these columns.');
                      });
                  };
                  this.model[key] = '';

                  let options = '';
                  formItem.layerURLs = {};
                  g.layers.forEach(layer => {
                      options += '<option value="' + layer.url + '">' + layer.title + '</option>';
                      formItem.layerURLs[layer.id] = layer.url;
                  });
                  formItem.type = 'template';

                  formItem.template = '<select ng-model="model[\'' + key + '\']" ng-change="form.selectFeature(form)">' + options + '</select>';
                  formItem.template += '<br><b>Add to form: column on layer</b>';
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
            let group = this.layerService.findGroupById(this.simAdminService.layerGroup);
            if (group && group.layers) {
                group.layers.forEach((layer: csComp.Services.IProjectLayer) => {
                    // unfortunately there is no reset layer function
                    layer.data.features.forEach(f => layer.layerSource.service.removeFeature(f));
                });
            }
            this.formLayers = [];
        }

        /**
         * Check if the specified layer exists, and if it doesn't, create it.
         */
        private checkAndCreateLayer(description: ICreateLayerDescription) {
            let layer = this.layerService.findLayer(description.layerId);
            if (!layer) {
                let group = this.layerService.findGroupById(this.simAdminService.layerGroup);
                if (!group) {
                    group = this.simWebService.createGroup(this.simAdminService.layerGroup, this.simAdminService.layerGroup);
                }

                let layerDescription : ILayerDescription = {
                    id: description.layerId,
                    title: description.layerTitle,
                    type: 'editablegeojson',
                    typeUrl: description.typeUrl,
                    timeAware: false,
                    opacity: 75,
                    data: {
                        'type': 'FeatureCollection',
                        'properties': {},
                        'features': []
                    }
                };

                layer = this.simWebService.createLayer(layerDescription, group);
                this.formLayers.push(layer.id);
                this.layerService.loadTypeResources(layer.typeUrl, false, () => {
                    console.log('Type resources loaded for: ' + layer.title);
                    this.toggleEditLayer(layer.id);
                    this.layerLoaded = true;
                });
            } else {
                // remember that we need this layer
                this.formLayers.push(layer.id);
                this.toggleEditLayer(layer.id);
                this.layerLoaded = true;
            }
        }

        private removeExcessLayers() {
            let group = this.layerService.findGroupById(this.simAdminService.layerGroup);
            if (group) {
                group.layers.forEach((layer: ProjectLayer) => {
                    if (this.formLayers.indexOf(layer.id) === -1) {
                        this.layerService.removeLayer(layer, true);
                    }
                });
            }
        }

        public toggleEditLayer(layerId) {
            if (!_.isUndefined(layerId)) {
                this._layer = this.layerService.findLayer(layerId);

                this.actionService.execute('activate layer', {
                    layerId: this._layer.id,
                });

                if (this._layer._gui.hasOwnProperty('editing') && this._layer._gui['editing'] === true) {
                    (<csComp.Services.EditableGeoJsonSource>this._layer.layerSource).stopEditing(this._layer);
                    this._layer.data.features.forEach(f => {
                        delete f._gui['editMode'];
                        this.layerService.updateFeature(f);
                        this.layerService.saveFeature(f);
                    });
                } else {
                    (<csComp.Services.EditableGeoJsonSource>this._layer.layerSource).startEditing(this._layer);
                    this._layer.data.features.forEach(f => {
                        this.layerService.editFeature(f, false);
                    });
                }
            }
        }
    }
}
