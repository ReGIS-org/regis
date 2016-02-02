module MyWidget {
    export class MyWidgetSvc {
       static $inject = [
            '$rootScope',
            'layerService',
            'messageBusService',
            'mapService',
            'dashboardService',
            '$http'
        ];

        constructor(
            private $rootScope: ng.IRootScopeService,
            private layerService: csComp.Services.LayerService,
            private messageBusService: csComp.Services.MessageBusService,
            private mapService: csComp.Services.MapService,
            private dashboardService: csComp.Services.DashboardService,
            private $http: ng.IHttpService) {
           this.dashboardService.widgetTypes['mywidget'] = <csComp.Services.IWidget> {
               id: 'mywidget',
               icon: 'images/myWidgetIcon.png',
               description: 'Show MyWidget widget'
           }
        }
    }

     /**
      * Register service
      */
    var moduleName = 'csComp';

    /**
      * Module
      */
    export var myModule;
    try {
        myModule = angular.module(moduleName);
    } catch (err) {
        // named module does not exist, so create one
        myModule = angular.module(moduleName, []);
    }

    myModule.service('myWidgetService', MyWidget.MyWidgetSvc);
}
