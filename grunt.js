/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',

    meta: {
      banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        ' <%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' +
        ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
    },

    replace: {
      dist: {
        options: {
          variables: {
            version: '<%= pkg.version %>',
            Compiler:'<%= grunt.file.read("src/compiler.core.js") %>',
            Generator:'<%= grunt.file.read("src/generator.core.js") %>',
            View:'<%= grunt.file.read("src/view.core.js") %>',
            Mask:'<%= grunt.file.read("src/mask.core.js") %>'
          }
        },
        
        files: {
          './': [ 'mask.*' ],
        }
      }
    },

    lint: {
      // files: ['src/**/*.core.js']
      files: ['mask.js']
    },

    qunit: {
      files: ['test/**/*.html']
    },

    concat: {
      dist:{
        src: ['<banner:meta.banner>', '<file_strip_banner:src/<%= pkg.name %>.js>'],
        dest: '<%= pkg.name %>.js'
      }
    },

    min: {

      dist: {
        src: ['<banner:meta.banner>', '<config:concat.dist.dest>'],
        dest: '<%= pkg.name %>.min.js'
      }
    },

    watch: {
      files: '<config:lint.files>',
      tasks: 'lint qunit'
    },

    jshint: {
      options: {
        curly: false,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: false,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        eqnull: true,
        browser: true,
        strict: false,

        loopfunc: true,
        expr: true,
        evil: true
      },
      
      globals: {
        define: true,
        require: true,
        module: true,
        exports: true
      }
    },
    uglify: {}
  });
  grunt.loadNpmTasks('grunt-replace');
  // Default task.
  // grunt.registerTask('default', 'lint qunit concat min replace');
  grunt.registerTask('default', 'lint qunit concat replace min');
  grunt.registerTask('travis', 'lint qunit');

};
