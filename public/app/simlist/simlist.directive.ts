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
                    webserviceUrl: '@simWebserviceUrl',
                    simulation: '@simName',
                    version: '@simVersion'
                },
                controller: SimListController,
                controllerAs: 'vm',
                bindToController: true
            };
        }]);

    export interface ISimListParameters {
        webserviceUrl: string;
        simulation: string;
        version: string;
    }

    export class SimListController {

        private webserviceUrl: string;
        private simulation: string;
        private version: string;
        private tasks: ITask[];
        private status: string;
        private parameters: ISimListParameters;
        private subscriptions: MessageBusHandle[];

        public static $inject = ['SimWebService', 'messageBusService', '$interval', '$scope', '$log', 'SimTaskService'];

        constructor(private SimWebService: App.SimWebService,
                    private messageBusService: csComp.Services.MessageBusService,
                    private $interval: ng.IIntervalService,
                    private $scope: ng.IScope,
                    private $log: ng.ILogService,
                    private SimTaskService: App.SimTaskService) {

            if ($scope.$parent.hasOwnProperty('widget') && $scope.$parent['widget'].hasOwnProperty('parameters')) {
                this.parameters = $scope.$parent['widget']['parameters'];
            }
            if (!this.webserviceUrl) {
                if (this.parameters.hasOwnProperty('webserviceUrl')) {
                    this.webserviceUrl = this.parameters.webserviceUrl;
                } else {
                    $log.error('SimCityDirective.SimListController: no URL provided');
                    return;
                }
            }

            if (!this.simulation) {
                if (this.parameters.hasOwnProperty('simulation')) {
                    this.simulation = this.parameters.simulation;
                } else {
                    $log.error('SimCityDirective.SimListController: No simulation provided');
                    return;
                }
            }

            if (!this.version) {
                if (this.parameters.hasOwnProperty('version')) {
                    this.version = this.parameters.version;
                } else {
                    $log.error('SimCityDirective.SimListController: No simulation version provided');
                    return;
                }
            }

            this.updateView();
            this.subscriptions = [];
            this.subscriptions.push(this.messageBusService.subscribe('sim-task', this.updateView));
            this.$interval(this.updateView, 100000);
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
            return this.SimWebService.list(this.webserviceUrl, this.simulation, this.version)
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
            this.SimTaskService.show(this.webserviceUrl, task, activeTab);
        }

        /** Remove given task. */
        public remove(task: ITask) {
            this.messageBusService.confirm(
                'Remove simulation',
                'Are you sure you want to remove simulation "' + task.input.simulation +
                ' (with id "' + task._id + '" from ensemble ' + task.input.ensemble + ')',
                (confirmed: boolean) => {
                    if (confirmed) {
                        this.SimWebService.delete(this.webserviceUrl, task._id, task._rev)
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
    }
}
