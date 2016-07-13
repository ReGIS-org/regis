module App {

    angular.module('csWebApp')
        .filter('bytes', bytes);

    function bytes() {
        var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'];

        return (bytes: string, precision: number): String => {
            var bytesNum = parseFloat(bytes);
            if (isNaN(bytesNum) || !isFinite(bytesNum)) {
                return '-';
            }
            var number = Math.max(1, Math.floor(Math.log(bytesNum) / Math.log(1000)));
            if (typeof precision === 'undefined') {
                precision = 1;
            }
            return (bytesNum / Math.pow(1000, Math.floor(number))).toFixed(precision) + ' ' + units[number];
        };
    }

}
