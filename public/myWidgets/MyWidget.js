var MyWidget;
(function (MyWidget) {
    /**
      * Config
      */
    var moduleName = 'csComp';
    try {
        MyWidget.myModule = angular.module(moduleName);
    }
    catch (err) {
        // named module does not exist, so create one
        MyWidget.myModule = angular.module(moduleName, []);
    }
    /**
      * Directive to display the available map layers.
      */
    MyWidget.myModule.directive('mywidget', [function () {
            return {
                restrict: 'E',
                scope: {},
                templateUrl: 'myWidget/MyWidget.tpl.html',
                replace: true,
                transclude: false,
                controller: MyWidgetCtrl
            };
        }
    ]);
})(MyWidget || (MyWidget = {}));
//# sourceMappingURL=MyWidget.js.map