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
        private id: string;
        private task: ITask;
        private status: string;
        private tab: string;

        public static $inject = ['SimWebService', 'SimAdminService', '$log', '$scope', 'layerService', 'messageBusService'];

        constructor(private SimWebService: App.SimWebService,
                    private SimAdminService: App.SimAdminService,
                    private $log: ng.ILogService,
                    private $scope: ng.IScope,
                    private layerService : csComp.Services.LayerService,
                    private messageBusService: csComp.Services.MessageBusService) {

            var parameters: any = {};
            if ($scope.$parent.hasOwnProperty('data')) {
                parameters = $scope.$parent['data'];
            }

            if (!this.id) {
                if (parameters.hasOwnProperty('id')) {
                    this.id = parameters.id;
                } else {
                    $log.error('SimCityDirective.SimTaskController: No id provided');
                    return;
                }
            }

            if (!this.tab) {
                if (parameters.hasOwnProperty('tab')) {
                    this.tab = parameters.tab;
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
        public updateTask = (): ng.IPromise<void> => {
            return this.SimWebService.get(this.SimAdminService.webserviceUrl, this.id)
                .then((result: ng.IHttpPromiseCallbackArg<ITask>) => {
                    this.task = result.data;
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

        public visualize(name: string, attachment: Object, type: string) {
            this.SimWebService.visualize(this.SimAdminService.webserviceUrl, this.task, name, attachment, type);
        }
    }
}
