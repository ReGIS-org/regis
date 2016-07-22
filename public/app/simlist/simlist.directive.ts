module App {
    import NotifyType = csComp.Services.NotifyType;
    import MessageBusHandle = csComp.Services.MessageBusHandle;

    angular
        .module('csWebApp')
        .directive('simList', [function (): ng.IDirective {
            return {
                templateUrl: 'app/simlist/simlist.directive.html',
                restrict: 'E',
                scope: {
                    simulation: '@simName',
                    version: '@simVersion'
                },
                controller: SimListController,
                controllerAs: 'vm',
                bindToController: true
            };
        }]);

    export class SimListController {
        private tasks: ITask[];
        private status: string;
        private subscriptions: MessageBusHandle[];
        private simulation: string;
        private version: string;
        private state: string;

        public static $inject = ['SimAdminService', 'SimWebService', 'messageBusService', '$interval', '$scope', '$log',
                                 'SimTaskService'];

        constructor(private SimAdminService: App.SimAdminService,
                    private SimWebService: App.SimWebService,
                    private messageBusService: csComp.Services.MessageBusService,
                    private $interval: ng.IIntervalService,
                    private $scope: ng.IScope,
                    private $log: ng.ILogService,
                    private SimTaskService: App.SimTaskService) {

            this.state = 'list';
            this.subscriptions = [];
            this.subscriptions.push(this.messageBusService.subscribe('sim-task', this.updateView));
            this.subscriptions.push(this.messageBusService.subscribe('sim-admin', (title: string, data: App.SimAdminMessage): void => {
                if (title === 'simulation-changed') {
                    this.simulation = data.simulation;
                    this.version = data.version;
                    this.updateView();
                }
            }));
            this.subscriptions.push(this.messageBusService.subscribe('project', (title: string, data?: any): void => {
                if (title === 'loaded') {
                    this.$interval(this.updateView, 100000);
                }
            }));
            this.subscriptions.push(this.messageBusService.subscribe('sim-task', (title: string, data?: any): void => {
                if (title === 'submitted' || title === 'cancelled') {
                    this.state = 'list';
                }
            }));
            this.tasks = [];
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
        }

        /**
         * Callback function for when the view may be updated.
         * @see http://stackoverflow.com/questions/12756423/is-there-an-alias-for-this-in-typescript
         * @see http://stackoverflow.com/questions/20627138/typescript-this-scoping-issue-when-called-in-jquery-callback
         * @todo notice the strange syntax, which is to preserve the this reference!
         */
        public updateView = (): ng.IPromise<void> => {
            return this.SimWebService.list(this.simulation, this.version)
                .then((response: ng.IHttpPromiseCallbackArg<ISimWebList<ITask>>) => {
                    this.tasks = response.data.rows.map(el => el.value);
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
                        this.status = 'Cannot load infrastructure overview ' + status;
                    }
                });
        };

        public viewTask(task: ITask, activeTab: string) {
            this.SimTaskService.show(task, activeTab);
        }

        /** Remove given task. */
        public remove(task: ITask) {
            this.messageBusService.confirm(
                'Remove simulation',
                'Are you sure you want to remove simulation "' + task.input.simulation +
                ' (with id "' + task._id + '" from ensemble ' + task.input.ensemble + ')',
                (confirmed: boolean) => {
                    if (confirmed) {
                        this.SimWebService.delete(task._id, task._rev)
                            .then(() => {
                                    this.messageBusService.publish('sim-task', 'removed');
                                    this.messageBusService.notify('Simulation', 'Removed simulation.',
                                        undefined, NotifyType.Success);
                                }, (response: ng.IHttpPromiseCallbackArg<{error: string}>) => {
                                    if (response.status === 409) {
                                        this.messageBusService.notify('Simulation', 'cannot remove simulation: ' +
                                            'it was modified', undefined, NotifyType.Error);
                                    } else if (response.data) {
                                        this.messageBusService.notify('Simulation', 'cannot remove simulation: ' +
                                            response.data.error, undefined, NotifyType.Error);
                                    } else {
                                        this.messageBusService.notify('Simulation', 'cannot remove simulation',
                                            undefined, NotifyType.Error);
                                    }
                                });
                    }
            });
        };

        public createSimulation() {
            this.state = 'newsimulation';
        }
    }
}
