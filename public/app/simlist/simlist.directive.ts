module App {
    import NotifyType = csComp.Services.NotifyType;
    import MessageBusHandle = csComp.Services.MessageBusHandle;
    import IWidget = csComp.Services.IWidget;

    angular
        .module('csWebApp')
        .directive('simList', [function (): ng.IDirective {
            return {
                templateUrl: 'app/simlist/simlist.directive.html',
                restrict: 'E',
                scope: {
                    formId: '@formId'
                },
                controller: SimListController,
                controllerAs: 'vm',
                bindToController: true,
                replace: true,    // Remove the directive from the DOM
            };
        }]);

    export interface SimListScope extends ng.IScope {
        show: boolean;
    }

    export interface TaskEnsemble {
        [key: string]: ITask[];
    }

    export class SimListController {
        private tasks: ITask[];
        private tasksByEnsemble: TaskEnsemble;
        private status: string;
        private subscriptions: MessageBusHandle[];
        private widget: IWidget;
        private update: ng.IPromise<void>;

        public static $inject = ['simAdminService', 'simWebService', 'messageBusService', 'layerService', '$interval', '$scope', '$log',
                                 'simTaskService'];

        constructor(private simAdminService: App.SimAdminService,
                    private simWebService: App.SimWebService,
                    private messageBusService: csComp.Services.MessageBusService,
                    private layerService: csComp.Services.LayerService,
                    private $interval: ng.IIntervalService,
                    private $scope: SimListScope,
                    private $log: ng.ILogService,
                    private simTaskService: App.SimTaskService) {

            this.$scope.show = true;

            this.subscriptions = [];
            this.subscriptions.push(this.messageBusService.subscribe('sim-task', this.updateView));
            this.subscriptions.push(this.messageBusService.subscribe('sim-admin', (title: string, data: App.SimAdminMessage): void => {
                if (title === 'simulation-changed') {
                    this.updateView();
                }
            }));
            this.subscriptions.push(this.messageBusService.subscribe('project', (title: string, data?: any): void => {
                if (title === 'loaded') {
                    this.update = this.$interval(this.updateView, 2000);
                }
            }));
            this.tasks = [];
            this.tasksByEnsemble = {};
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

        /**
         * Callback function for when the view may be updated.
         * @see http://stackoverflow.com/questions/12756423/is-there-an-alias-for-this-in-typescript
         * @see http://stackoverflow.com/questions/20627138/typescript-this-scoping-issue-when-called-in-jquery-callback
         * @todo notice the strange syntax, which is to preserve the this reference!
         */
        public updateView = (): ng.IPromise<void> => {
            return this.simWebService.list(this.simAdminService.simulationName, this.simAdminService.simulationVersion)
                .then((response: ng.IHttpPromiseCallbackArg<ISimWebList<ITask>>) => {
                    this.tasks = response.data.rows.map(el => el.value);
                    var start: TaskEnsemble = {};
                    this.tasksByEnsemble = response.data.rows.reduce(function (ensembles, cur, index): TaskEnsemble {
                        if (!ensembles.hasOwnProperty(cur.value['input']['ensemble'])) {
                            ensembles[cur.value['input']['ensemble']] = [];
                        }
                        ensembles[cur.value['input']['ensemble']].push(cur.value);
                        return ensembles;
                    }, start);
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

        public addAttachmentLayers(task: ITask) {
            this.viewTask(task, 'files');
            if (task.files) {
                Object.keys(task.files).forEach(name => {
                    if (task.files[name].content_type === 'application/json'
                        || task.files[name].content_type === 'application/vnd.geo+json') {
                        this.simWebService.visualize(task, name);
                    }
                });
            }
            if (task._attachments) {
                Object.keys(task._attachments).forEach(name => {
                    if (task._attachments[name].content_type === 'application/json'
                        || task.files[name].content_type === 'application/vnd.geo+json') {
                        this.simWebService.visualize(task, name);
                    }
                });
            }
            this.simWebService.visualizeInput(task);
        }

        public viewTask(task: ITask, activeTab: string) {
            this.simTaskService.show(task, activeTab);
        }

        /** Remove given task. */
        public remove(task: ITask) {
            this.messageBusService.confirm(
                'Remove simulation',
                'Are you sure you want to remove simulation "' + task.input.simulation +
                ' (with id "' + task._id + '" from ensemble ' + task.input.ensemble + ')',
                (confirmed: boolean) => {
                    if (confirmed) {
                        this.simWebService.delete(task._id, task._rev)
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
        }
    }
}
