# SIM-CITY Common Sense based application
Example project that can be used to quick start a new csWeb application. Fork me and roll-your-own app to get started.

Source code, Wiki's and issue tracker can all be found [here](https://github.com/TNOCS/csWeb).

# Getting started
We depend on node and bower and use typescript to develop. You can install all necessary tools by invoking:
```shell
npm i -g typescript@1.6.2 bower nodemon http-server
```
## Compiling and Running
```shell
npm install
cd public && bower install
cd ..
tsc -p .
node server.js
```
Alternatively, replace the last command with `nodemon server.js` or go to the public folder and run `http-server`.
Visit http://localhost:3003 to see the application running.

## Configuring the application

If everything went well, you should now have your application up and running. However, most likely you don't want to call your application csWeb-example, so here are a few steps to make the app your own.

## For developers

### Developers wishing to change the csWeb framework

If you wish to change the underlying csWeb framework, you also need to checkout [csWeb](https://github.com/TNOCS/csWeb). In csWeb, create npm and bower links, which you can subsequently use in csWeb-example.

I assume that csWeb-example and csWeb share the same parent folder. In csWeb, do the following:

```shell
gulp init
bower link
cd dist-npm && npm link
```

And in csWeb-example, run:

```shell
npm link csweb
cd public && bower link csweb
tsc
node server.js
```

### Developers wishing to just extend their application

If you wish to create a new widget or service, and don't want to add it to the csWeb framework (e.g. because it is very specific), you can extend the example application yourself. For example, when creating a new widget and service, follow these steps.

1. Create a myWidgets folder, and in this folder.
2. Create a MyWidget.ts file for registering your widget.
3. Create a MyWidgetCtrl.ts and MyWidget.tpl.html file which contains the widget controller and its template.
4. Create a MyWidgetSvc.ts file for having a persistant service (you can also use it to register your widget, or alternatively, you can do that in the AppCtrl (in app/app.ts).
5. Add the TypeScript files to tsconfig.json.
6. Add the generated JavaScript files to the index.html (before the app/app.js).
7. In the AppCtrl, inject your MyWidgetSvc so it is instantiated.

Some examples:

* `MyWidget.ts`:

```typescript
module MyWidget {
    /**
      * Config
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

    /**
      * Directive to display the available map layers.
      */
    myModule.directive('mywidget', [function() : ng.IDirective {
            return {
                restrict   : 'E',     // E = elements, other options are A=attributes and C=classes
                scope      : {
                },      // isolated scope, separated from parent. Is however empty, as this directive is self contained by using the messagebus.
                templateUrl: 'MyWidget/MyWidget.tpl.html',
                replace      : true,    // Remove the directive from the DOM
                transclude   : false,   // Add elements and attributes to the template
                controller   : MyWidgetCtrl
            }
        }
    ]);
}
```

* `MyWidgetSvc.ts`:

```typescript
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
```

* `MyWidgetCtrl.ts`:

```typescript
module hmf {
    export class MyWidgetData {
        title: string;
    }

    export interface IMyWidgetScope extends ng.IScope {
        vm: MyWidgetCtrl;
        data: MyWidgetData;
        minimized: boolean;
    }

    export class MyWidgetCtrl {
        private scope: IMyWidgetScope;
        private widget: csComp.Services.IWidget;
        private parentWidget: JQuery;

        public static $inject = [
            '$scope',
            '$timeout',
            'layerService',
            'messageBusService',
            'mapService'
        ];

        constructor(
            private $scope: IMyWidgetScope,
            private $timeout: ng.ITimeoutService,
            private $layerService: csComp.Services.LayerService,
            private $messageBus: csComp.Services.MessageBusService,
            private $mapService: csComp.Services.MapService
            ) {
            $scope.vm = this;
            var par = <any>$scope.$parent;
            this.widget = par.widget;

            $scope.data = <MyWidgetData>this.widget.data;
            $scope.data.mdText = $scope.data.content;
            $scope.minimized = false;

            this.parentWidget = $('#' + this.widget.elementId).parent();

            if (typeof $scope.data.featureTypeName !== 'undefined' && typeof $scope.data.dynamicProperties !== 'undefined' && $scope.data.dynamicProperties.length > 0) {
                // Hide widget
                this.parentWidget.hide();
                this.$messageBus.subscribe('feature', (action: string, feature: csComp.Services.IFeature) => {
                    switch (action) {
                        case 'onFeatureDeselect':
                        case 'onFeatureSelect':
                            this.selectFeature(feature);
                            break;
                        default:
                            break;
                    }
                });
            }

            if (typeof $scope.data.url === 'undefined') return;
            $.get($scope.data.url, (md) => {
                $timeout(() => {
                    $scope.data.content = $scope.data.mdText = md;
                }, 0);
            });
        }

        private selectFeature(feature: csComp.Services.IFeature) {

		}
    }
}
```
