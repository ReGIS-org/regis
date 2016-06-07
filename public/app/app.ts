module App {
    export interface IAppLocationService extends ng.ILocationService {
        $$search:{ layers:string };
    }

    export interface IAppScope extends ng.IScope {
        vm:AppCtrl;
        title:string;
        showMenuRight:boolean;
        featureSelected:boolean;
        layersLoading:number;
    }

    // TODO For setting the current culture for string formatting (note you need to include public/js/cs/stringformat.YOUR-CULTURE.js. See sffjs.1.09.zip for your culture.)
    declare var sffjs;
    declare var String;
    declare var omnivore;

    export class AppCtrl {
        // It provides $injector with information about dependencies to be injected into constructor
        // it is better to have it close to the constructor, because the parameters must match in count and type.
        // See http://docs.angularjs.org/guide/di
        static $inject = [
            '$scope',
            '$location',
            'mapService',
            'layerService',
            'messageBusService',
            'dashboardService',
            'geoService'
        ];

        public areaFilter:AreaFilter.AreaFilterModel;
        public contourAction:ContourAction.ContourActionModel;

        // dependencies are injected via AngularJS $injector
        // controller's name is registered in Application.ts and specified from ng-controller attribute in index.html
        constructor(private $scope:IAppScope,
                    private $location:IAppLocationService,
                    private $mapService:csComp.Services.MapService,
                    private $layerService:csComp.Services.LayerService,
                    private $messageBusService:csComp.Services.MessageBusService,
                    private $dashboardService:csComp.Services.DashboardService,
                    private geoService:csComp.Services.GeoService) {
            sffjs.setCulture('nl-NL');

            this.$scope.vm = this;
            this.$scope.showMenuRight = false;
            this.$scope.featureSelected = false;
            this.$scope.layersLoading = 0;

            this.$messageBusService.subscribe('project', (action:string) => {
                if (action === 'loaded') {
                    this.areaFilter = new AreaFilter.AreaFilterModel();
                    this.$layerService.addActionService(this.areaFilter);
                    this.contourAction = new ContourAction.ContourActionModel();
                    this.$layerService.addActionService(this.contourAction);

                    if ($scope.$root.$$phase !== '$apply' && $scope.$root.$$phase !== '$digest') {
                        $scope.$apply();
                    }
                }
            });

            this.$messageBusService.subscribe('feature', this.featureMessageReceived);
            this.$messageBusService.subscribe('layer', this.layerMessageReceived);

            this.$layerService.visual.rightPanelVisible = false; // otherwise, the rightpanel briefly flashes open before closing.

            this.$layerService.openSolution('data/projects/projects.json', $location.$$search.layers);
        }

        /**
         * Publish a toggle request.
         */
        public toggleMenuRight() {
            this.$messageBusService.publish('sidebar', 'toggle');
        }

        private layerMessageReceived = (title: string, layer: csComp.Services.ProjectLayer) => {
            switch (title) {
                case 'loading':
                    this.$scope.layersLoading += 1;
                    console.log('Loading');
                    break;
                case 'activated':
                    if (this.$scope.layersLoading >= 1) this.$scope.layersLoading -= 1;
                    console.log('Activated');
                    break;
                case 'error':
                    this.$scope.layersLoading = 0;
                    console.log('Error loading');
                    break;
                case 'deactivate':
                    break;
            }

            var $contextMenu = $('#contextMenu');

            $('body').on('contextmenu', 'table tr', e => {
                $contextMenu.css({
                    display: 'block',
                    left: e.pageX,
                    top: e.pageY
                });
                return false;
            });

            $contextMenu.on('click', 'a', () => {
                $contextMenu.hide();
            });

            // NOTE EV: You need to call apply only when an event is received outside the angular scope.
            // However, make sure you are not calling this inside an angular apply cycle, as it will generate an error.
            if (this.$scope.$root.$$phase !== '$apply' && this.$scope.$root.$$phase !== '$digest') {
                this.$scope.$apply();
            }
        };

        private featureMessageReceived = (title: string) => {
            switch (title) {
                case 'onFeatureSelect':
                    this.$scope.featureSelected = true;
                    break;
                case 'onFeatureDeselect':
                    this.$scope.featureSelected = false;
                    break;
            }
        };

        /**
         * Callback function
         * @see {http://stackoverflow.com/questions/12756423/is-there-an-alias-for-this-in-typescript}
         * @see {http://stackoverflow.com/questions/20627138/typescript-this-scoping-issue-when-called-in-jquery-callback}
         * @todo {notice the strange syntax, which is to preserve the this reference!}
         */
        public toggleMenu():void {
            this.$mapService.invalidate();
        }

        public toggleSidebar():void {
            this.$messageBusService.publish('sidebar', 'toggle');
            window.console.log('Publish toggle sidebar');
        }

        public isActive(viewLocation: string): boolean {
            return viewLocation === this.$location.path();
        }
    }

    // http://jsfiddle.net/mrajcok/pEq6X/
    //declare var google;

    // Start the application
    angular.module('csWebApp')
        .controller('appCtrl', AppCtrl);
}
