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

    class AppCtrl {
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

            $scope.vm = this;
            $scope.showMenuRight = false;
            $scope.featureSelected = false;
            $scope.layersLoading = 0;

            $messageBusService.subscribe('project', (action:string) => {
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

            $messageBusService.subscribe('feature', this.featureMessageReceived);
            $messageBusService.subscribe('layer', this.layerMessageReceived);

            this.$layerService.visual.rightPanelVisible = false; // otherwise, the rightpanel briefly flashes open before closing.

            this.$layerService.openSolution('data/projects/projects.json', $location.$$search.layers);
        }

        /**
         * Publish a toggle request.
         */
        // toggleMenuRight() {
        //     this.$messageBusService.publish('sidebar', 'toggle');
        // }

        private layerMessageReceived(title:string, layer:csComp.Services.ProjectLayer): void {
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

            $('body').on('contextmenu', 'table tr', function (e) {
                $contextMenu.css({
                    display: 'block',
                    left: e.pageX,
                    top: e.pageY
                });
                return false;
            });

            $contextMenu.on('click', 'a', function () {
                $contextMenu.hide();
            });

            // NOTE EV: You need to call apply only when an event is received outside the angular scope.
            // However, make sure you are not calling this inside an angular apply cycle, as it will generate an error.
            if (this.$scope.$root.$$phase !== '$apply' && this.$scope.$root.$$phase !== '$digest') {
                this.$scope.$apply();
            }
        }

        private featureMessageReceived(title: string): void {
            switch (title) {
                case 'onFeatureSelect':
                    this.$scope.featureSelected = true;
                    break;
                case 'onFeatureDeselect':
                    this.$scope.featureSelected = false;
                    break;
            }
        }

        /**
         * Callback function
         * @see {http://stackoverflow.com/questions/12756423/is-there-an-alias-for-this-in-typescript}
         * @see {http://stackoverflow.com/questions/20627138/typescript-this-scoping-issue-when-called-in-jquery-callback}
         * @todo {notice the strange syntax, which is to preserve the this reference!}
         */
        // toggleMenu():void {
        //     this.$mapService.invalidate();
        // }
        //
        // toggleSidebar():void {
        //     this.$messageBusService.publish('sidebar', 'toggle');
        //     window.console.log('Publish toggle sidebar');
        // }
        //
        // private isActive(viewLocation: string): boolean {
        //     return viewLocation === this.$location.path();
        // }
    }

    // http://jsfiddle.net/mrajcok/pEq6X/
    //declare var google;

    // Start the application
    angular.module('csWebApp', [
        'csComp',
        'ngSanitize',
        'ui.bootstrap',
        'ui.select',
        'schemaForm',
        'LocalStorageModule',
        'angularUtils.directives.dirPagination',
        'pascalprecht.translate',
        'ngCookies', 'angularSpectrumColorpicker',
        'wiz.markdown', 'ngAnimate',
        'simCitySimDirective'
    ])
        .config(localStorageServiceProvider => {
            localStorageServiceProvider.prefix = 'csMap';
        })
        .config(TimelineServiceProvider => {
            TimelineServiceProvider.setTimelineOptions({
                'width': '100%',
                'eventMargin': 0,
                'eventMarginAxis': 0,
                'editable': false,
                'layout': 'box'
            });
        })
        .config(($locationProvider) => {
            $locationProvider.html5Mode({
                enabled: true,
                requireBase: false
            });
        })
        .config(($logProvider) => {
            $logProvider.debugEnabled(true);
        })
        .config($translateProvider => {
            // TODO ADD YOUR LOCAL TRANSLATIONS HERE, OR ALTERNATIVELY, CHECK OUT
            // http://angular-translate.github.io/docs/#/guide/12_asynchronous-loading
            // Translations.English.locale['MAP_LABEL'] = 'MY AWESOME MAP';
            $translateProvider.translations('en', Translations.English.locale);
            $translateProvider.translations('nl', Translations.Dutch.locale);
            $translateProvider.preferredLanguage('en');
            // Enable escaping of HTML
            $translateProvider.useSanitizeValueStrategy('escape');
        })
        .config($languagesProvider => {
            // Defines the GUI languages that you wish to use in your project.
            // They will be available through a popup menu.
            var languages = [];
            languages.push({
                key: 'en',
                name: 'English',
                img: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZ' +
                     'SBJbWFnZVJlYWR5ccllPAAAAflJREFUeNpinDRzn5qN3uFDt16+YWBg+Pv339+KGN0rbVP+//2rW5tf0Hfy/2+mr99+yKpy' +
                     'Ol3Ydt8njEWIn8f9zj639NC7j78eP//8739GVUUhNUNuhl8//ysKeZrJ/v7z10Zb2PTQTIY1XZO2Xmfad+f7XgkXxuUrVB6' +
                     'cjPVXef78JyMjA8PFuwyX7gAZj97+T2e9o3d4BWNp84K1NzubTjAB3fH0+fv6N3qP/ir9bW6ozNQCijB8/8zw/TuQ7r4/nd' +
                     'vN5mZgkpPXiis3Pv34+ZPh5t23//79Rwehof/9/NDEgMrOXHvJcrllgpoRN8PFOwy/fzP8+gUlgZI/f/5xcPj/69e/37//A' +
                     'UX+/mXRkN555gsOG2xt/5hZQMwF4r9///75++f3nz8nr75gSms82jfvQnT6zqvXPjC8e/srJQHo9P9fvwNtAHmG4f8zZ6dD' +
                     'c3bIyM2LTNlsbtfM9OPHH3FhtqUz3eXX9H+cOy9ZMB2o6t/Pn0DHMPz/b+2wXGTvPlPGFxdcD+mZyjP8+8MUE6sa7a/xo6P' +
                     'ykn1s4zdzIZ6///8zMGpKM2pKAB0jqy4UE7/msKat6Jw5mafrsxNtWZ6/fjvNLW29qv25pQd///n+5+/fxDDVbcc//P/zx/' +
                     '36m5Ub9zL8+7t66yEROcHK7q5bldMBAgwADcRBCuVLfoEAAAAASUVORK5CYII='
            });
            languages.push({
                key: 'nl',
                name: 'Nederlands',
                img: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0R' +
                     'Vh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAFXSURBVHjaYvzPgAD/UNlYEUAAkuTgCAAIBgJggq5VoAs1qM0v' +
                     'dzmMz362vezjokxPGimkEQ5WoAQEKuK71zwCCKyB4c//J8+BShn+/vv/+w/D399AEox+//8FJH/9/wUU+cUoKw20ASCAWBh' +
                     'EDf/LyDOw84BU//kDtgGI/oARmAHRDJQSFwVqAAggxo8fP/Ly8oKc9P8/AxjiAoyMjA8ePAAIIJZ///5BVIM0MOBWDpRlZP' +
                     'zz5w9AALH8gyvCbz7QBrCJAAHEyKDYX15r/+j1199//v35++/Xn7+///77DST/wMl/f4Dk378K4jx7O2cABBALw7NP77/+e' +
                     'v3xB0gOpOHfr99AdX9/gTVASKCGP//+8XCyMjC8AwggFoZfIHWSwpwQk4CW/AYjsKlA8u+ff////v33998/YPgBnQQQQIzA' +
                     'aGNg+AVGf5AYf5BE/oCjGEIyAQQYAGvKZ4C6+xXRAAAAAElFTkSuQmCC'
            });
            $languagesProvider.setLanguages(languages);
        })
        .constant('webserviceUrl')
        .controller('appCtrl', AppCtrl)
        .run((SchemaService, messageBusService) => {
            SchemaService.addCustomTypeHandler('point2d', (formItem, _schemaItem, _form) => {
                formItem.type = 'template';
                formItem.template =
                    '<div ng-if="item.id">{{item.id}}</div>' +
                    '<div ng-if="!item.id">({{item.x}}, {{item.y}})</div>';
            });
            SchemaService.addCustomTypeHandler('layer', function (formItem, _schemaItem, _form) {
                formItem.type = 'array';

                var layerId = formItem.layer;
                var featureId = formItem.featureId;
                var key = formItem.key;

                messageBusService.subscribe('feature', function (title, feature) {
                    var supportedOps = ['dropped', 'onFeatureUpdated', 'onFeatureRemoved'];

                    if (feature && layerId === feature.layerId && featureId === feature.properties.featureTypeId
                        && supportedOps.indexOf(title) >= 0) {
                        var f = {
                            id: feature.properties.Name,
                            x: feature.geometry.coordinates[0],
                            y: feature.geometry.coordinates[1]
                        };

                        switch (title) {
                            case 'dropped':
                                SchemaService.modelAddValue(key, 'list', f);
                                break;
                            case 'onFeatureUpdated':
                                SchemaService.modelUpdateValue(key, 'list', f);
                                break;
                            case 'onFeatureRemoved':
                                SchemaService.modelDeleteValue(key, 'list', f);
                                break;
                        }
                    }
                });
            });
        });
}
