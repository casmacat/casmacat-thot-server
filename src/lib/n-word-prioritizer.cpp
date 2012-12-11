// Moses plugin for casmacat

#include <fstream>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>

#include <casmacat/config.h>
#include <casmacat/IWordPriorityEngine.h>
#include <casmacat/IPluginFactory.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;

class NWordPrioritizer: public IWordPriorityEngine, Loggable {
  size_t _n_word_len;
  Logger *_logger;
public:
  NWordPrioritizer(int n_word_len = 1): _n_word_len(n_word_len), _logger(0) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~NWordPrioritizer() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };


  virtual void getWordPriorities(const std::vector<std::string> &source,
                                 const std::vector<std::string> &target,
                                 const std::vector<bool> &validated,
                                       std::vector<int> &priorities)
  {
    priorities.resize(validated.size());

    int priority = 1; 
    size_t count = 0;
    for (size_t i = 0; i < validated.size(); i++) {
      if (validated[i]) priorities[i] = 0;
      else {
        priorities[i] = priority;
        count++;
        if (count == _n_word_len) {
          count = 0;
          priority++;
        } 
      }
    }
  }

  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "I'm joining the logger";
  }

  virtual void update(const std::vector<std::string> &source,
                      const std::vector<std::string> &target) {}

};

class NWordPriorityFactory: public IWordPriorityFactory {
  size_t _n_word_len;
  Logger *_logger;
public:
  NWordPriorityFactory(): _n_word_len(1), _logger(0) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~NWordPriorityFactory() {
    LOG(INFO) << "I, " << typeid(*this).name() <<  ", am free!!!";
  };

  virtual int init(int argc, char *argv[], Context *context = 0) {
    if (argc > 2) { // invalid number of arguments
      return EXIT_FAILURE;
    }

    /* use context to store or retrieve objects from other modules
       remember that the one that sets the object is the _owner_, i.e.,
       the one responsible of freeing the resources (delete, etc)
    if (context and context->get<unsigned int>(string("seed")) != 0) {
        seed = *context->get<unsigned int>(string("seed"));
        cerr << typeid(*this).name() << " - retrieving seed from context: " << seed << "\n";
    }
    */

    if (argc == 2) {
      _n_word_len = casmacat::convert_string<int>(string(argv[1]));
      if (not finite(_n_word_len)) { // check if initialization went wrong
        cerr << "Invalid n word len = '" << argv[1] << "'\n";
        return EXIT_FAILURE;
      }
    }

    return EXIT_SUCCESS;
  }

  virtual string getVersion() { return PACKAGE_VERSION; }
  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "I'm joining the logger";
  }

  virtual IWordPriorityEngine *createInstance(const std::string &specialization_id = "") {
    NWordPrioritizer *rc = new NWordPrioritizer(_n_word_len);
    rc->setLogger(_logger);
    return rc;
  }

  virtual void deleteInstance(IWordPriorityEngine *instance) {
    delete instance;
  }

};


EXPORT_CASMACAT_PLUGIN(IWordPriorityEngine, NWordPriorityFactory);

