module App {
    // var scripts = document.getElementsByTagName("script")
    // var currentScriptPath = scripts[scripts.length-1].src;

    import Expertise = csComp.Services.Expertise;
    import NotifyType = csComp.Services.NotifyType;
    import IFeature = csComp.Services.IFeature;
    import MessageBusHandle = csComp.Services.MessageBusHandle;
    import ICustomTypeParser = App.ICustomTypeParser;
    import StringMap = App.StringMap;
    import ProjectLayer = csComp.Services.ProjectLayer;

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
                    webserviceUrl: '@simWebserviceUrl',
                    simulation: '@simName',
                    version: '@simVersion'
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
     * The SimFormController controls two forms
     *
     * 1) The simulation submition form for the parameters and submitting a task.
     *    This form is generated using angular-json-schema-form from the json description
     *    provided by the sim-city-webservice.
     *
     * 2) The admin form to change the simulation and version, this is only visible
     *    if admin mode is on.
     */
    class SimFormController {
        /**
         * Directive parameters
         */
        private simulation: string;
        private version: string;
        private webserviceUrl: string;

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

        /**
         * Admin form
         */
        private hideAdminForm;
        private versionOptions: string[];
        private simulationOptions: string[];

        public static $inject = ['$scope', '$log', '$q', 'SchemaService', 'SimWebService', 'messageBusService', 'mapService', 'layerService'];

        constructor(private $scope: ISimFormScope,
                    private $log: ng.ILogService,
                    private $q: ng.IQService,
                    private SchemaService: App.SchemaService,
                    private SimWebService: App.SimWebService,
                    private messageBusService: csComp.Services.MessageBusService,
                    private mapService: csComp.Services.MapService,
                    private layerService: csComp.Services.LayerService) {

            if (!this.webserviceUrl) {
                $log.error('SimCityDirective.FormController: no URL provided');
                return;
            }

            // If not in expert mode or higher we need a simulation and version
            if (!this.simulation || !this.version) {
                $log.error('SimCityDirective.FormController: No simulation provided');
                return;
            }

            // Add this controller to the angular scope
            this.$scope.vm = this;

            // Initialize the simulation form
            this.schema = {};
            this.form = [];
            this.model = {};

            // Initialize custom type mapping BEFORE getting
            // the simulation form
            this.initializeCustomTypes();

            // Get the simulation form from the webservice
            this.getForm(this.simulation, this.version);

            // Initialize the admin form
            this.hideAdminForm = true;
            this.versionOptions = [];
            this.simulationOptions = [];
            if (mapService.expertMode >= Expertise.Admin) {
                this.enableExpertMode();
            }

            // Subscribe to changes in admin status
            this.messageBusService.subscribe('expertMode', (title: string, expertMode: Expertise) => {
                if (title !== 'newExpertise') return;
                if (mapService.expertMode >= Expertise.Admin) {
                    this.enableExpertMode();
                } else {
                    this.hideAdminForm = true;
                }
            });
        }

        /**
         * Submit the simulation from to the webservice
         */
        public onSubmit(form: any) {
            // Check if the form is valid
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
        }

        /**
         * Get the simulation form from the webservice.
         */
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

        /**
         * Initializing custom type handlers.
         *
         * These handlers are used called when a schema is parsed
         */
        private initializeCustomTypes(): void {
            this.featureSubscriptions = [];
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
                    this.messageBusService.subscribe('project', (action:string) => {
                        if (action === 'loaded') {
                            this.checkAndCreateLayer(layerId);
                        }
                    });

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

        // Functions the controller exposes

        /**
         * The simulation has been changed using the admin form.
         *
         * Populate the version select
         */
        public simulationChanged(): void {
            this.resetForm();
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
            this.resetForm();
            this.getForm(this.simulation, this.version);
        }

        /**
         * Helper function to find the object index in the model of a feature
         */
        private indexOfFeature(key: string, id: string): ng.IPromise<number> {
            let index = this.model[key].map(f => f.id).indexOf(id);
            return this.$q((resolve, reject) => (index >= 0 ? resolve(index) : reject()));
        }

        /**
         * Check if the specified layer exists, and if it doesn't, create it.
         *
         *
         */
        private checkAndCreateLayer(layerId: string) {
            if (!this.layerService.findLayer(layerId)) {
                let newLayer = new ProjectLayer();
                let group = this.layerService.findGroupById('Buttons');

                newLayer.id = layerId;
                newLayer.type = 'editablegeojson';
                newLayer.renderType = 'geojson';
                newLayer.typeUrl = '/explore/resource/matsim';
                // For some reason using .timeAware gives an error when compiling
                newLayer['timeAware'] = false;
                newLayer.data = {
                    'type': 'FeatureCollection',
                    'properties': {},
                    'features': []
                };

                this.layerService.initLayer(group, newLayer);
                group.layers.push(newLayer);
            }
            /*
            {
            "id": "matsim",
            "title": "matsim",
            "type": "editablegeojson",
            "renderType": "geojson",
            "heatmapItems": null,
            "data": {
                "type": "FeatureCollection",
                "properties": {},
                "features": []
            },
            "typeUrl": "/explore/resource/matsim",
            "opacity": 100,
            "timeaware": false
            }
            */
        }
    }
}
