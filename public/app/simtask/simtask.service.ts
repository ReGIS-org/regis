module App {
    import ITask = App.ITask;
    import RightPanelTab = csComp.Services.RightPanelTab;

    export class SimTaskService {
        public static $inject = ['dashboardService'];

        constructor(private $dashboardService:csComp.Services.DashboardService) {}

        public show(webserviceUrl:string, task:ITask) {
            var panel = new RightPanelTab();
            panel.title = 'Simulation ' + this.task.id;
            panel.container = 'rightpanel';
            panel.directive = 'sim-task';
            panel.data = {
                webserviceUrl: webserviceUrl,
                id: task.id
            };
            this.$dashboardService.activateTab(panel);
        }
    }


    angular
        .module('csWebApp')
        .service('SimTaskService', SimTaskService);
}
