module App {

    angular.module('csWebApp')
        .filter('formatSeconds', formatSeconds);

    function formatSeconds() {
        return (seconds: number, defaultString: string): string => {
            if (seconds > 0) {
                return new Date(seconds * 1000).toString();
            } else {
                return defaultString || '';
            }
        };
    }
}
