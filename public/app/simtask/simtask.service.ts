module App {
    import ITask = App.ITask;
    import RightPanelTab = csComp.Services.RightPanelTab;

    export class SimTaskService {
        public static $inject = ['dashboardService'];

        constructor(private $dashboardService: csComp.Services.DashboardService) {}

        public show(task:ITask, activeTab:string) {
            var panel = new RightPanelTab();
            panel.title = 'Simulation ' + task._id;
            panel.container = 'rightpanel';
            panel.directive = 'sim-task';
            panel.data = {
                id: task._id,
                tab: activeTab
            };
            this.$dashboardService.activateTab(panel);
        }
    }

    angular
        .module('csWebApp')
        .service('SimTaskService', SimTaskService);
}
