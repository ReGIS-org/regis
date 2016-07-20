module App {
    import ITask = App.ITask;
    import ProjectLayer = csComp.Services.ProjectLayer;
    import ProjectGroup = csComp.Services.ProjectGroup;

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
        private tab: string;

        public static $inject = ['SimWebService', '$log', '$scope', 'layerService'];

        constructor(private SimWebService: App.SimWebService,
                    private $log: ng.ILogService,
                    private $scope: ng.IScope,
                    private layerService : csComp.Services.LayerService) {

            var parameters: any = {};
            if ($scope.$parent.hasOwnProperty('data')) {
                parameters = $scope.$parent['data'];
            }
            if (!this.webserviceUrl) {
                if (parameters.hasOwnProperty('webserviceUrl')) {
                    this.webserviceUrl = parameters.webserviceUrl;
                } else {
                    $log.error('SimCityDirective.SimTaskController: no webserviceURL provided');
                    return;
                }
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
            return this.SimWebService.get(this.webserviceUrl, this.id)
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
            // Calculate the correct url to the result
            let url;
            if (type === 'attachment') {
                url = this.webserviceUrl + '/simulation/' + this.task._id + '/' + name;
            } else if (type === 'upload') {
                url = attachment;
            }

            console.log('visualizing ' + name + ' at: ' + url);

            // Make sure the layer group exists
            let groupId = this.task.input.ensemble + '_' + this.task.input.simulation;
            let group = this.layerService.findGroupById(groupId);
            if (group === null) {
                let newGroup = new ProjectGroup();
                newGroup.id = groupId;
                newGroup.languages = {
                    'en': {
                        'title': groupId,
                        'description': 'Layers added manually for test purposes'
                    }
                };
                newGroup.clustering = true;

                group = ProjectGroup.deserialize(newGroup);

                this.layerService.project.groups.push(group);
                this.layerService.initGroup(group);
            }

            // Add the data as a layer
            let layerId = this.task._id + '_' + name;
            if (!this.layerService.findLayer(layerId)) {
                let newLayer = new ProjectLayer();

                newLayer.id = layerId;
                newLayer.type = 'geojson';
                newLayer.renderType = 'geojson';
                newLayer.url = url;
                newLayer.timeAware = false;
                newLayer.opacity = 75;

                if (this.task.hasOwnProperty('typeUrl')) {
                    newLayer.typeUrl = this.task.typeUrl;
                }
                if (this.task.hasOwnProperty('defaultFeatureType')) {
                    newLayer.defaultFeatureType = this.task.defaultFeatureType;
                }


                this.layerService.initLayer(group, newLayer);
                group.layers.push(newLayer);
            }
        }
    }
}
