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
