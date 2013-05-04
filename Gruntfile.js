/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

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
            abstract:'<%= grunt.file.read("src/abstract.core.js") %>',
            compiler:'<%= grunt.file.read("src/compiler.core.js") %>',
            generator:'<%= grunt.file.read("src/generator.core.js") %>',
            view:'<%= grunt.file.read("src/view.core.js") %>',
            mask:'<%= grunt.file.read("src/mask.core.js") %>',
            console:'<%= grunt.file.read("src/console.core.js") %>',
            constants:'<%= grunt.file.read("src/mask.constants.js") %>',
            helpers:'<%= grunt.file.read("src/mask.helpers.js") %>'
          }
        },
        
        files: {
          './': [ 'mask.*' ],
        }
      }
    },

    // lint: {
    //   // files: ['src/**/*.core.js']
    //   files: ['mask.js']
    // },

    qunit: {
      dist: ['test/**/*.html']
    },

    concat: {
      options:{
        banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        ' <%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
        ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n'
      },
      dist:{
        src: ['src/factory.js'],
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
        evil: true,

        globals: {
          define: true,
          require: true,
          module: true,
          exports: true,
          console: true,
          Exp: true,
          Backbone: true
        }
      },

     dist: ['<% pkg.name %>.js'],
     
    },
    uglify: {
      options:{
        report:'min'
      },
      dist: {
        files: {
          'mask.min.js': ['mask.js']
        }
      }
    }
  });
 /* grunt.loadNpmTasks('grunt-replace');
  // Default task.
  // grunt.registerTask('default', 'lint qunit concat min replace');
  grunt.registerTask('default', 'concat replace lint qunit min');
  grunt.registerTask('travis', 'lint qunit');
*/
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint')
  grunt.loadNpmTasks('grunt-replace');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('default', [/*'jshint:src',*/ 'concat', 'replace', 'jshint:dist', 'qunit', 'uglify:dist']);
  grunt.registerTask('travis',  ['jshint:dist', 'qunit:dist']);
};
