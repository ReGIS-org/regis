module App {
    import MessageBusHandle = csComp.Services.MessageBusHandle;
    import ISimWebObject = App.ISimWebObject;
    import IHost = App.IHost;

    angular
        .module('csWebApp')
        .directive('simJob', [function (): ng.IDirective {
            return {
                templateUrl: 'app/simjob/simjob.directive.html',
                restrict: 'E',
                scope: {
                    formId: '@formId'
                },
                controller: SimJobController,
                controllerAs: 'vm',
                bindToController: true,
                replace: true,    // Remove the directive from the DOM
            };
        }]);

    export interface SimJobScope extends ng.IScope {
        loading: boolean;
    }

    export class SimJobController {
        private jobs: { [key:string]:IJob };
        private status: string;
        private subscriptions: MessageBusHandle[];
        private update: ng.IPromise<void>;

        private hosts: string[];
        private selectedHost: string;

        public static $inject = ['simAdminService', 'simWebService', 'messageBusService', 'layerService', '$interval', '$timeout', '$q', '$scope', '$log',
                                 'simTaskService'];

        constructor(private simAdminService: App.SimAdminService,
                    private simWebService: App.SimWebService,
                    private messageBusService: csComp.Services.MessageBusService,
                    private layerService: csComp.Services.LayerService,
                    private $interval: ng.IIntervalService,
                    private $timeout: ng.ITimeoutService,
                    private $q: ng.IQService,
                    private $scope: SimJobScope,
                    private $log: ng.ILogService,
                    private simTaskService: App.SimTaskService) {
            this.subscriptions = [];
            this.hosts = [];
            this.subscriptions.push(this.messageBusService.subscribe('sim-task', this.updateView));
            this.subscriptions.push(this.messageBusService.subscribe('sim-admin', (title: string, data: App.SimAdminMessage): void => {
                if (title === 'simulation-changed') {
                    this.updateView();
                }
            }));

            this.selectedHost = null;
            this.simWebService.hosts().then(result => {
                let hostList : ISimWebObject<IHost> = result.data;
                Object.keys(hostList).forEach(hostname => {
                    this.hosts.push(hostname);
                    if (hostList[hostname].default) {
                        this.selectedHost = hostname;
                    }
                });
            });
            this.update = this.$interval(this.updateView, 10000);
            this.jobs = {};
            this.updateView();
        }

        /**
         * When the widget is stopped, unsubscribe from the messageBusService
         *
         * The widget is stopped when the dashboard is switched
         */
        public stop() {
            this.subscriptions.forEach((handle: MessageBusHandle) => {
                this.messageBusService.unsubscribe(handle);
            });
            this.subscriptions = [];
            this.$interval.cancel(this.update);
        }

        public startJob() {
            this.simWebService.startJob(this.selectedHost)
            .then(() => this.updateView(), (response) => {
                this.messageBusService.notifyError('Failed to start job', response.message);
            });
        }

        /**
         * Callback function for when the view may be updated.
         * @see http://stackoverflow.com/questions/12756423/is-there-an-alias-for-this-in-typescript
         * @see http://stackoverflow.com/questions/20627138/typescript-this-scoping-issue-when-called-in-jquery-callback
         * @todo notice the strange syntax, which is to preserve the this reference!
         */
        public updateView = () => {
            if (!this.$scope.loading) {
                this.$scope.loading = true;
                this.$q.all([
                    this.$timeout(1000),
                    this.simWebService.jobs()
                    .then((response: ng.IHttpPromiseCallbackArg<ISimWebList<IJob>>) => {
                        this.jobs = {};
                        response.data.rows.forEach(el => {
                            this.jobs[el.key] = el.value;
                            this.jobs[el.key].startDate = new Date();
                            this.jobs[el.key].startDate.setTime(el.value.start * 1000);
                        });
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
                            this.status = 'Cannot load job overview ' + status;
                        }
                    })])
                    .finally(() => this.$scope.loading = false);
            };
        }
    }
}
