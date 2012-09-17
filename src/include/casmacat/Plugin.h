#ifndef PLUGIN_HPP
#define PLUGIN_HPP

#include <iostream>
#include <cassert>
#include <stdexcept>
#include <typeinfo>

#include <string>
#include <vector>
// #include <cstdint>
#include <cstring>

#include <casmacat/utils.h>

//#define PLUGIN_USE_LIBTOOL


#ifdef PLUGIN_USE_LIBTOOL
  #include <ltdl.h>
#else
  #include <dlfcn.h>
#endif


namespace casmacat {

  template <typename value_type>
  class Plugin {
    typedef value_type* (*create_fn)(int argc, char *argv[]);
    typedef void (*destroy_fn)(value_type *);

    std::string plugin_fn;
    std::string default_args;
    std::string create_symbol_name;
    std::string destroy_symbol_name;

    create_fn create_;
    destroy_fn destroy_;
#ifdef PLUGIN_USE_LIBTOOL
    lt_dlhandle library_h_;
#else
    void *library_h_;
#endif
  public:

    Plugin(const std::string &_plugin_fn, const std::string &_default_args = "",
    		const std::string &_create_symbol_name = "new_plugin", const std::string &_destroy_symbol_name = "delete_plugin")
           : plugin_fn(_plugin_fn), default_args(_default_args),
             create_symbol_name(_create_symbol_name),destroy_symbol_name(_destroy_symbol_name)
    {
      using std::cout;
      using std::cerr;

      const char* dlsym_error = NULL;
#ifdef PLUGIN_USE_LIBTOOL
      #define plugin_dlopen  lt_dlopenadvise
      #define plugin_dlerror lt_dlerror
      #define plugin_dlsym   lt_dlsym
      #define plugin_dlclose lt_dlclose

      dlsym_error = plugin_dlerror();
      if (lt_dlinit() != 0 or dlsym_error) {
          std::cerr << "Cannot initialize library system: " << dlsym_error << std::endl;
          throw std::runtime_error(dlsym_error); 
      }
      lt_dladvise advise;
      lt_dladvise_init(&advise);
      lt_dladvise_ext(&advise);
      lt_dladvise_global(&advise);

#else
      #define plugin_dlopen  dlopen
      #define plugin_dlerror dlerror
      #define plugin_dlsym   dlsym
      #define plugin_dlclose dlclose

      int advise = RTLD_NOW | RTLD_GLOBAL;
#endif
     
      if (plugin_fn.empty()) {
        cerr << "Plugin undefined: " << dlsym_error  << std::endl;
        throw std::runtime_error(dlsym_error);
      }
  
      // load the dynamic 
      cerr << "Loading plug-in from '" << plugin_fn << "'" << std::endl;
      library_h_ = plugin_dlopen(plugin_fn.c_str(), advise);
      dlsym_error = plugin_dlerror();
      if (library_h_ == 0 or dlsym_error) {
          cerr << "Cannot load library: " << dlsym_error << std::endl;
          throw std::runtime_error(dlsym_error); 
      }
  
      // load the creator
      create_ = reinterpret_cast<create_fn>(plugin_dlsym(library_h_, create_symbol_name.c_str()));
      dlsym_error = plugin_dlerror();
      if (dlsym_error) {
          cerr << "Cannot load symbol'" << create_symbol_name << "': " << dlsym_error << std::endl;
          throw std::runtime_error(dlsym_error); 
      }
      else if (not create_) {
          cerr << "Incompatible symbol '" << create_symbol_name << "': " << dlsym_error << std::endl;
          throw std::runtime_error(dlsym_error);
      }

       // load the destroyer 
      destroy_ = reinterpret_cast<destroy_fn>(plugin_dlsym(library_h_, destroy_symbol_name.c_str()));
      dlsym_error = plugin_dlerror();
      if (dlsym_error) {
          cerr << "Cannot load symbol '" << destroy_symbol_name << "': " << dlsym_error << std::endl;
          throw std::runtime_error(dlsym_error); 
      }
      else if (not destroy_) {
          cerr << "Incompatible symbol '" << destroy_symbol_name << "': " << dlsym_error << std::endl;
          throw std::runtime_error(dlsym_error);
      }
  
#ifdef PLUGIN_USE_LIBTOOL
      lt_dladvise_destroy(&advise);
#endif
    }

    virtual ~Plugin() {
      plugin_dlclose(library_h_);
#ifdef PLUGIN_USE_LIBTOOL
      lt_dlexit();
#endif
    };

    // Note: value_type needs to be explicitly declared so that SWIG does not complain
    value_type *createCArgs(int argc, char *argv[]) {
      return create_(argc, argv);
    }


    value_type *createVectorStringArgs(const std::vector<std::string> &args) {
      int argc = args.size() + 1;
      char **argv = new char *[argc + 1];
      std::string name = plugin_fn;
      argv[0] = new char[ strlen(name.c_str()) + 1 ];;
      strcpy(argv[0], name.c_str());
      for (size_t argc = 0;argc < args.size(); argc++) {
        argv[argc + 1] = new char[ strlen(args[argc].c_str()) + 1 ];
        strcpy(argv[argc + 1], args[argc].c_str());
      }
      argv[argc] = NULL;

      value_type *value = create_(argc, argv);

      for (size_t i = 0; i < argc; i++) {
        delete argv[i];
      }
      delete[] argv;

      return value;
    }

    value_type *createStringArgs(const std::string &cmd) {
      std::vector<std::string> args;
      tokenize(cmd, args, std::string(" "));
      return createVectorStringArgs(args);
    }

    value_type *create() {
      return createStringArgs(default_args);
    }

    void destroy(value_type *obj) {
      destroy_(obj);
    }

  private:
    // Following the rule of three
    Plugin(const Plugin&);   // Disallow copy contructor
    Plugin& operator=(const Plugin&); // Disallow assignment operator

  };

  template<typename Interface, typename Class>
  bool provides(Class *_object) {
    Interface *object = dynamic_cast<Interface *>(_object);
    return object != 0;
  }

  template<typename Interface>
  Interface *as(void *_object) {
    return dynamic_cast<Interface *>(_object);
  }

}

#endif
