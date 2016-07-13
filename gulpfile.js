var gulp          = require('gulp');
var tsconfig      = require('gulp-tsconfig');
var exec          = require('child_process').execSync;
var install       = require('gulp-install');
var runSequence   = require('run-sequence');
var del           = require('del');
var uglify        = require('gulp-uglify');
var useref        = require('gulp-useref');
var rename        = require('gulp-rename');
var debug         = require('gulp-debug');
var concat        = require('gulp-concat');
var plumber       = require('gulp-plumber');
var watch         = require('gulp-watch');
var changed       = require('gulp-changed');
var templateCache = require('gulp-angular-templatecache');
var deploy        = require('gulp-gh-pages');
var purify        = require('gulp-purifycss');
var concatCss     = require('gulp-concat-css');
var ts            = require('gulp-typescript');
var tslint        = require('gulp-tslint');
var tstypings     = require('gulp-typings');
var OfflineSearch = require('csweb-offline-search');
var sourcemaps    = require('gulp-sourcemaps');
var debug         = require('gulp-debug');
var nodemon       = require('gulp-nodemon');

/** Destination of the client/server distribution */
var dest = 'dist/';
var path2csWeb = '../csWeb/';
// Gulp task upstream...
// Configure gulp scripts
// Output application name
var appName = 'sim-city-cs';

/** Create a new distribution by copying all required CLIENT files to the dist folder. */
gulp.task('dist_client', function() {
    // Copy client side files
    // Copy app, images, css, data and swagger
    gulp.src('public/app/**/*.js*')
        .pipe(plumber())
        .pipe(gulp.dest(dest + 'public/app/'));
    gulp.src('public/css/**/*.*')
        .pipe(plumber())
        .pipe(gulp.dest(dest + 'public/css/'));
    gulp.src('public/data/**/*.*')
        .pipe(plumber())
        .pipe(gulp.dest(dest + 'public/data/'));
    gulp.src('public/swagger/**/*.*')
        .pipe(plumber())
        .pipe(gulp.dest(dest + 'public/swagger/'));
    gulp.src('./public/images/**/*.*')
        .pipe(plumber())
        .pipe(gulp.dest(dest + 'public/images/'));
    // Copy index files and favicon
    gulp.src(['./public/*.html', './public/favicon.ico', './public/mode-json.js'])
        .pipe(plumber())
        .pipe(gulp.dest(dest + 'public/'));
    // Copy bower components of csweb, and others (ignoring any linked csweb files)
    gulp.src('public/bower_components/csweb/dist-bower/**/*.*')
        .pipe(plumber())
        .pipe(gulp.dest(dest + 'public/bower_components/csweb/dist-bower/'));
    gulp.src(['public/bower_components/**/*.*', '!public/bower_components/csweb/**/*.*'])
        .pipe(plumber())
        .pipe(gulp.dest(dest + 'public/bower_components/'));
});

/** Create a new distribution by copying all required SERVER files to the dist folder. */
gulp.task('dist_server', function() {
    // Copy server side files
    gulp.src(['./server.js', './server.js.map', './configuration.json', './LICENSE'])
        .pipe(plumber())
        .pipe(gulp.dest(dest));
    // Copy npm modules of csweb, and others (ignoring any linked csweb files)
    gulp.src(['node_modules/**/*.*', '!node_modules/csweb/**/*.*'])
        .pipe(plumber())
        .pipe(changed(dest + 'node_modules/'))
        .pipe(gulp.dest(dest + 'node_modules/'));
   gulp.src('node_modules/csweb/dist-npm/package.json')
        .pipe(plumber())
        .pipe(gulp.dest(dest + 'node_modules/csweb/'));
    return gulp.src('node_modules/csweb/dist-npm/**/*.*')
        .pipe(plumber())
        .pipe(changed(dest + 'node_modules/csweb/dist-npm/'))
        .pipe(gulp.dest(dest + 'node_modules/csweb/dist-npm/'));
});

/** Create a new distribution by copying all required CLIENT+SERVER files to the dist folder. */
gulp.task('dist', ['dist_client', 'dist_server']);


gulp.task('typings', function (cb) {
    return gulp.src("./typings.json")
        .pipe(tstypings());
        cb();
        //will install all typingsfiles in pipeline.
});

function buildTsconfig(config, globPattern, basedir) {
    config.tsConfig.comment = '! This tsconfig.json file has been generated automatically, please DO NOT edit manually.';
    return gulp.src(globPattern, { base: '.' })
        .pipe(rename(function (path) {
            path.dirname = path.dirname.replace(basedir, '.');
        }))
        .pipe(tsconfig(config)())
        .pipe(gulp.dest(basedir));
}

// This task updates the typescript dependencies on tsconfig file
gulp.task('tsconfig', function () {
    var globPattern = [
        "typings/index.d.ts",
        "server.ts",
        "public/app/**/*.ts",
    ];
    var config = {
        tsOrder: ['**/*.ts'],
        tsConfig: {
            version: '1.8.9',
            compilerOptions: {
                target: 'es5',
                module: 'commonjs',
                noImplicitAny: false,
                removeComments: false,
                preserveConstEnums: true,
                noLib: false,
                outDir: '.',
                sourceMap: true,
            },
            filesGlob: globPattern
        }
    };
    return buildTsconfig(config, globPattern, './');
});

gulp.task('ts-lint', function () {
    var tsProject = ts.createProject('tsconfig.json');
    return tsProject.src()
        .pipe(tslint())
        .pipe(tslint.report('prose', {
          emitError: false
        }));
});

gulp.task('tsc', function() {
    var tsProject = ts.createProject('tsconfig.json');
    return tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(ts(tsProject))
        .pipe(sourcemaps.write('.'))
        .pipe(debug({title: 'compiled:'}))
        .pipe(gulp.dest('.'));
});

// Install required npm and bower installs for example folder
gulp.task('install', function(cb) {
  return gulp.src([
      './package.json',       // npm install
      './public/bower.json',  // bower install
    ])
    .pipe(install(cb));
});

/** Initialiaze the project */
gulp.task('init', function() {
  runSequence(
    'typings',
    'tsconfig',
    'ts-lint',
    'tsc'
  );
});

gulp.task('clean', function(cb) {
    // NOTE Careful! Removes all generated javascript files and certain folders.
    del([
        'public/app/**/*.js',
    ], {
        force: true
    }, cb);
});

/** Deploy it to the github pages */
gulp.task('deploy-githubpages', function() {
    return gulp.src(dest + 'public/**/*')
        .pipe(deploy({
            branch: 'master',
            cacheDir: '.deploy'
        }));
});

gulp.task('serve', function() {
    nodemon({
        script: 'server.js'
      , verbose: false
      , ext: 'js html'
      , env: { 'NODE_ENV': 'development' }
    })
});

gulp.task('watch', function() {
    var allSources = sources.concat(definitions);
    return gulp.watch(allSources, ['init'])
});

gulp.task('deploy', ['dist_client', 'deploy-githubpages']);

gulp.task('default', ['init']);
