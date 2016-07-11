module App {
    import ITask = App.ITask;

    angular
        .module('csWebApp')
        .directive('simTask', [function ():ng.IDirective {
            return {
                templateUrl: 'app/simtask/simtask.directive.html',
                restrict: 'E',
                scope: {
                    webserviceUrl: '@simWebserviceUrl',
                    id: '@simId'
                },
                controller: SimTaskController,
                controllerAs: 'vm',
                bindToController: true
            };
        }]);

    class SimTaskController {
        private webserviceUrl: string;
        private id: string;
        private task: ITask;
        private status: string;

        public static $inject = ['SimWebService', '$log'];

        constructor(private SimWebService:App.SimWebService,
                    private $log:ng.ILogService) {

            var parameters: any;
            if ($scope.$parent.hasOwnProperty('widget') && $scope.$parent['widget'].hasOwnProperty('parameters')) {
                parameters = $scope.$parent['widget']['parameters'];
            }
            if (!this.webserviceUrl) {
                if (parameters.webserviceUrl) {
                    this.webserviceUrl = parameters.webserviceUrl;
                } else {
                    $log.error('SimCityDirective.SimTaskController: no webserviceURL provided');
                    return;
                }
            }

            if (!this.id) {
                if (parameters.id) {
                    this.id = parameters.id;
                } else {
                    $log.error('SimCityDirective.SimTaskController: No id provided');
                    return;
                }
            }
            this.status = 'Loading task...';
            this.task = null;
            this.updateTask();
        }

        /**
         * Callback function for when the view may be updated.
         * @see http://stackoverflow.com/questions/12756423/is-there-an-alias-for-this-in-typescript
         * @see http://stackoverflow.com/questions/20627138/typescript-this-scoping-issue-when-called-in-jquery-callback
         * @todo notice the strange syntax, which is to preserve the this reference!
         */
        public updateTask = ():ng.IPromise<void> => {
            return this.SimWebService.get(this.webserviceUrl, this.id)
                .then((response:ng.IHttpPromiseCallbackArg<ITask>) => {
                    this.task = response.data;
                    if (this.status) {
                        delete this.status;
                    }
                }, response => {
                    if (this.status) {
                        var status;
                        if (response.status === 0) {
                            status = '';
                        } else {
                            status = '(code ' + response.status + ')';
                        }
                        this.status = 'Cannot load task ' + status;
                    }
                });
        };
    }
}
