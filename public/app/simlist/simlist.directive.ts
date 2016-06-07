module App {
    import NotifyType = csComp.Services.NotifyType;
    angular
        .module('csWebApp')
        .directive('simForm', [function (): ng.IDirective {
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

    class SimListController {
        public static $inject = ['SimWebService', 'messageBusService'];

        private webserviceUrl: string;
        private simulation: string;
        private version: string;
        private tasks: any[];
        private status: string;

        constructor(private SimWebService: App.SimWebService,
                    private messageBusService: csComp.Services.MessageBusService) {
            this.updateView();
        }

        public updateView(): ng.IPromise<void> {
            return this.SimWebService.list(this.webserviceUrl, this.simulation, this.version)
                .then(response => {
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
        }

        public remove(task) {
            this.messageBusService.confirm(
                'Remove simulation',
                'Are you sure you want to remove simulation "' + task.input.simulation +
                ' (with id "' + task.id + '" from ensemble ' + task.ensemble + ')',
                () => {
                    this.SimWebService.delete(this.webserviceUrl, task.id, task.rev)
                        .then(this.updateView,
                            (response) => {
                                if (response.status === 409) {
                                    this.messageBusService.notify('Simulation', 'cannot remove simulation: ' +
                                        'it was modified', undefined, NotifyType.Error);
                                } else if (response.data) {
                                    this.messageBusService.notify('Simulation', 'cannot remove simulation: ' +
                                        response.data, undefined, NotifyType.Error);
                                } else {
                                    this.messageBusService.notify('Simulation', 'cannot remove simulation',
                                        undefined, NotifyType.Error);
                                }
                            })
                        .then(
                            () => {
                                this.messageBusService.notify('Simulation', 'Removed simulation.',
                                    undefined, NotifyType.Success);
                            }, () => {
                                this.messageBusService.notify('Simulation', 'Removed simulation (but failed to ' +
                                    'reload simulation overview).', undefined, NotifyType.Success);
                            });
            });
        }
    }
}
