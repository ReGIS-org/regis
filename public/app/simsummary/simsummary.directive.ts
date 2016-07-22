module App {
    angular
        .module('csWebApp')
        .directive('simSummary', [function ():ng.IDirective {
            return {
                templateUrl: 'app/simsummary/simsummary.directive.html',
                restrict: 'E',
                controller: OverviewController,
                controllerAs: 'vm',
                bindToController: true
            };
        }]);


        class OverviewController {
            private jobs: any[];
            private status: string;
            private tasks: any[];
            private subscriptions: csComp.Services.MessageBusHandle[];

            public static $inject = ['$interval', 'messageBusService', 'SimAdminService', 'SimWebService'];
            constructor(
                $interval: ng.IIntervalService,
                private messageBusService: csComp.Services.MessageBusService,
                private SimAdminService: App.SimAdminService,
                private SimWebService: App.SimWebService) {
                this.jobs = [];
                this.tasks = [];
                this.status = 'Loading...';
                this.subscriptions = [];
                this.subscriptions.push(this.messageBusService.subscribe('sim-task', this.loadOverview));

                //Put in interval, first trigger after 10 seconds
                $interval(this.loadOverview, 10000);
                //invoke initialy
                this.loadOverview();
            }

            public stop() {
                this.subscriptions.forEach((handle: csComp.Services.MessageBusHandle) => {
                    this.messageBusService.unsubscribe(handle);
                });
                this.subscriptions = [];
            }

            /**
             * Loads and populates the overview
             */
            public loadOverview = (): void => {
                this.SimWebService.summary()
                    .then((data: ISimWebSummary) => {
                        this.jobs = data.jobs;
                        this.tasks = data.tasks;
                        if (this.status) {
                            this.status = '';
                        }
                    }, (msg: string) => {
                        if (this.status) {
                            this.status = msg;
                        }
                    });
            }
        }
}
