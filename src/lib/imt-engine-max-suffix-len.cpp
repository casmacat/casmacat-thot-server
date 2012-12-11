// Moses plugin for casmacat

#include <fstream>
#include <sstream>
#include <iterator>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>

#include <casmacat/config.h>
#include <casmacat/IImtEngine.h>
#include <casmacat/IPluginFactory.h>
#include <casmacat/Plugin.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;

class DecoratorImtSession: public IInteractiveMtSession {
  size_t _max_suffix_len;
  IInteractiveMtSession *_base;
  IInteractiveMtEngine *_base_engine;
public:
  DecoratorImtSession(size_t max_suffix_len, IInteractiveMtSession *base, IInteractiveMtEngine *base_engine):
                      _max_suffix_len(max_suffix_len), _base(base), _base_engine(base_engine) {};
  virtual ~DecoratorImtSession() { if (_base_engine != 0) _base_engine->deleteSession(_base); };

  /* Set partial validation of a translation */
  virtual void setPartialValidation(const vector<string> &partial_translation,
                                    const vector<bool> &validated,
                                          vector<string> &corrected_translation,
                                          vector<bool> &corrected_validated)
  {
    // DO YOUR PRE/POSTPROCESSING HERE
    _base->setPartialValidation(partial_translation, validated, corrected_translation, corrected_validated);
  }

  /* Set prefix of a translation */
  virtual void setPrefix(const vector<string> &prefix,
                         const vector<string> &suffix,
                         const bool last_token_is_partial,
                               vector<string> &corrected_suffix)
  {
    // DO YOUR PRE/POSTPROCESSING HERE
    _base->setPrefix(prefix, suffix, last_token_is_partial, corrected_suffix);
    // cut off suffix length to maximum allowed
    cerr << "BEFORE: ";
    copy(corrected_suffix.begin(), corrected_suffix.end(), ostream_iterator<string>(cerr, " "));
    cerr << "\n";
    if (corrected_suffix.size() >  + prefix.size() + _max_suffix_len) corrected_suffix.resize( + prefix.size() + _max_suffix_len);
    cerr << "AFTER: ";
    copy(corrected_suffix.begin(), corrected_suffix.end(), ostream_iterator<string>(cerr, " "));
    cerr << "\n";
  }

  virtual void rejectSuffix(const vector<string> &prefix,
                            const vector<string> &suffix,
                            const bool last_token_is_partial,
                                  vector<string> &corrected_suffix)
  {
    // DO YOUR PRE/POSTPROCESSING HERE
    setPrefix(prefix, suffix, last_token_is_partial, corrected_suffix);
  }
};


class DecoratorImtEngine: public IInteractiveMtEngine {
  size_t _max_suffix_len;
  IInteractiveMtFactory *_base_factory;
  IInteractiveMtEngine *_base;
public:
  DecoratorImtEngine(size_t max_suffix_len, IInteractiveMtEngine *base, IInteractiveMtFactory *base_factory):
                     _max_suffix_len(max_suffix_len), _base(base), _base_factory(_base_factory) {};
  virtual ~DecoratorImtEngine() {
    if (_base_factory != 0) _base_factory->deleteInstance(_base);
 };

  /* Update translation models with source/target pair (total or partial translation) */
  virtual void validate(const vector<string> &source,
                        const vector<string> &target,
                        const vector<bool> &validated)
  {
    // DO YOUR PRE/POSTPROCESSING HERE
    _base->validate(source, target, validated);
  }

  /* Set partial validation of a translation */
  virtual void translate(const std::vector<std::string> &source,
                               std::vector<std::string> &target)
  {
    // DO YOUR PRE/POSTPROCESSING HERE
    _base->translate(source, target);
  }


  /* Update translation models with source/target pair (total or partial translation) */
  virtual void update(const std::vector<std::string> &source,
                      const std::vector<std::string> &target)
  {
    // DO YOUR PRE/POSTPROCESSING HERE
    _base->update(source, target);
  }

  /**
   * initialize IMT session
   */
  virtual IInteractiveMtSession *newSession(const vector<string> &source) {
    IInteractiveMtSession *_base_session = _base->newSession(source);
    return new DecoratorImtSession(_max_suffix_len, _base_session, _base);
  }

  /**
   * delete IMT session
   */
  virtual void deleteSession(IInteractiveMtSession *session) {
    delete session;
  }
};


class DecoratorImtFactory: public IInteractiveMtFactory {
  size_t _max_suffix_len;
  Plugin<IInteractiveMtFactory> *_plugin;
  IInteractiveMtFactory *_base;
public:
  DecoratorImtFactory(): _max_suffix_len(-1), _plugin(0), _base(0) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~DecoratorImtFactory() {
    if (_plugin != 0) {
      if (_base) _plugin->destroy(_base);
      delete _plugin;
    }
  }

  int init_base(int &argc, char *argv[], Context *context = 0) {
    if (argc < 4) { // invalid number of arguments
      return EXIT_FAILURE;
    }

    // obtain real argc for this plugin and pargv, pargc for _base plugin
    int i = 0;
    for (; i < argc and strcmp(argv[i], "--") != 0; i++);
    char **pargv = argv + i + 1;
    int   pargc = argc - i - 1;
    argc = i;

    string plugin_fn = pargv[0];
    string plugin_fn_name = pargv[1];
    ostringstream plugin_args;
    copy(pargv + 2, pargv + pargc, ostream_iterator<char *>(plugin_args, " "));
//    for (int i = 0; i < pargc; i++) plugin_args;


    _plugin = new Plugin<IInteractiveMtFactory>(plugin_fn, plugin_args.str(), plugin_fn_name);
    if (_plugin == 0) {
      cerr << "Could not create base plugin '" << plugin_fn << "'\n";
      return EXIT_FAILURE;
    }

    _base = _plugin->create(context);
    if (_base == 0) {
      cerr << "Could not create base factory for '" << plugin_fn << "'\n";
      return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
  }

  /** initialize the IMT engine with main-like parameters */
  virtual int init(int argc, char *argv[], Context *context = 0) {
    // initialize base plugin which is defined by the arguments after '--'
    // as a result argc changes to the actual size of the args for this plugin
    int status = init_base(argc, argv, context);
    if (status != EXIT_SUCCESS) return status;

    /* DO YOUR INITIALIZATION HERE */

    if (argc == 2) {
      _max_suffix_len = casmacat::convert_string<unsigned int>(string(argv[1]));
      if (not finite(_max_suffix_len)) { // check if initialization went wrong
        cerr << "Invalid max suffix length = '" << argv[1] << "'\n";
        return EXIT_FAILURE;
      }
      cerr << "Max suffix length set to " << _max_suffix_len << "\n";
    }

    return EXIT_SUCCESS;
  }

  virtual string getVersion() { return PACKAGE_VERSION; }


  virtual IInteractiveMtEngine *createInstance(const std::string &specialization_id = "") {
    IInteractiveMtEngine *_base_instance = _base->createInstance(specialization_id);
    return new DecoratorImtEngine(_max_suffix_len, _base_instance, _base);
  }

  virtual void deleteInstance(IInteractiveMtEngine *instance) {
    delete instance;
  }

};

EXPORT_CASMACAT_PLUGIN(IInteractiveMtEngine, DecoratorImtFactory);

