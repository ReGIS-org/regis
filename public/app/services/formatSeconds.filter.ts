module App {

    angular.module('csWebApp')
        .filter('formatSeconds', ['$filter', formatSeconds]);

    function formatSeconds($filter) {
        return (seconds: number, defaultString: string): string => {
            if (seconds > 0) {
                return $filter('amDateFormat')(new Date(seconds * 1000), 'YYYY-MM-DD HH:mm:ss');
            } else {
                return defaultString || '';
            }
        };
    }
}
