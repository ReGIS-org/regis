var hmf;
(function (hmf) {
    var MyWidgetData = (function () {
        function MyWidgetData() {
        }
        return MyWidgetData;
    })();
    hmf.MyWidgetData = MyWidgetData;
    var MyWidgetCtrl = (function () {
        function MyWidgetCtrl($scope, $timeout, $layerService, $messageBus, $mapService) {
            var _this = this;
            this.$scope = $scope;
            this.$timeout = $timeout;
            this.$layerService = $layerService;
            this.$messageBus = $messageBus;
            this.$mapService = $mapService;
            $scope.vm = this;
            var par = $scope.$parent;
            this.widget = par.widget;
            $scope.data = this.widget.data;
            $scope.data.mdText = $scope.data.content;
            $scope.minimized = false;
            this.parentWidget = $('#' + this.widget.elementId).parent();
            if (typeof $scope.data.featureTypeName !== 'undefined' && typeof $scope.data.dynamicProperties !== 'undefined' && $scope.data.dynamicProperties.length > 0) {
                // Hide widget
                this.parentWidget.hide();
                this.$messageBus.subscribe('feature', function (action, feature) {
                    switch (action) {
                        case 'onFeatureDeselect':
                        case 'onFeatureSelect':
                            _this.selectFeature(feature);
                            break;
                        default:
                            break;
                    }
                });
            }
            if (typeof $scope.data.url === 'undefined')
                return;
            $.get($scope.data.url, function (md) {
                $timeout(function () {
                    $scope.data.content = $scope.data.mdText = md;
                }, 0);
            });
        }
        MyWidgetCtrl.prototype.selectFeature = function (feature) {
        };
        MyWidgetCtrl.$inject = [
            '$scope',
            '$timeout',
            'layerService',
            'messageBusService',
            'mapService'
        ];
        return MyWidgetCtrl;
    })();
    hmf.MyWidgetCtrl = MyWidgetCtrl;
})(hmf || (hmf = {}));
//# sourceMappingURL=MyWidgetCtrl.js.map