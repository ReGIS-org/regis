var MyWidget;
(function (MyWidget) {
    var MyWidgetSvc = (function () {
        function MyWidgetSvc($rootScope, layerService, messageBusService, mapService, dashboardService, $http) {
            this.$rootScope = $rootScope;
            this.layerService = layerService;
            this.messageBusService = messageBusService;
            this.mapService = mapService;
            this.dashboardService = dashboardService;
            this.$http = $http;
            this.dashboardService.widgetTypes['mywidget'] = {
                id: 'mywidget',
                icon: 'images/myWidgetIcon.png',
                description: 'Show MyWidget widget'
            };
        }
        MyWidgetSvc.$inject = [
            '$rootScope',
            'layerService',
            'messageBusService',
            'mapService',
            'dashboardService',
            '$http'
        ];
        return MyWidgetSvc;
    })();
    MyWidget.MyWidgetSvc = MyWidgetSvc;
    /**
     * Register service
     */
    var moduleName = 'csComp';
    try {
        MyWidget.myModule = angular.module(moduleName);
    }
    catch (err) {
        // named module does not exist, so create one
        MyWidget.myModule = angular.module(moduleName, []);
    }
    MyWidget.myModule.service('myWidgetService', MyWidget.MyWidgetSvc);
})(MyWidget || (MyWidget = {}));
//# sourceMappingURL=MyWidgetSvc.js.map