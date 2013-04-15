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
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;

string random_string() {
  static string charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

  size_t length = size_t(rand() % 10);
  string result;
  result.resize(length);

  for (int i = 0; i < length; i++) {
    result[i] = charset[rand() % charset.length()];
  }

  return result;
}

class RandomImtSession: public IInteractiveMtSession {
public:
  RandomImtSession() {};
  RandomImtSession(const vector<string> &_source): source(_source) {};
  virtual ~RandomImtSession() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };

  /* Set partial validation of a translation */
  virtual void setPartialValidation(const vector<string> &partial_translation,
                                    const vector<bool> &validated,
                                          vector<string> &corrected_translation,
                                          vector<bool> &corrected_validated)
  {
    corrected_translation = partial_translation;
    corrected_validated = validated;
    for (size_t t = 0; t < corrected_translation.size(); t++) {
      if (not corrected_validated[t] and (rand() / double(RAND_MAX)) > 0.5) {
        corrected_translation[t] = random_string();
      }
    }
  }

  /* Set prefix of a translation */
  virtual void setPrefix(const vector<string> &prefix,
                         const vector<string> &suffix,
                         const bool last_token_is_partial,
                               vector<string> &corrected_suffix)
  {
    //vector<string> partial_translation(prefix), corrected_translation;

    //vector<bool> validated, corrected_validated;
    //validated.resize(prefix.size(), true);

    //if (not suffix.empty()) {
    //  partial_translation.insert(partial_translation.end(), suffix.begin(), suffix.end());
    //  validated.resize(prefix.size() + suffix.size(), false);
    //}
    //else {
    //  vector<string> simulated_suffix(max(source.size() - prefix.size(), size_t(0)), "<nothing>");
    //  partial_translation.insert(partial_translation.end(), simulated_suffix.begin(), simulated_suffix.end());
    //  validated.resize(prefix.size() + simulated_suffix.size(), false);
    //}

    //setPartialValidation(partial_translation, validated, corrected_translation, corrected_validated);

    //corrected_suffix.clear();
    //corrected_suffix.insert(corrected_suffix.end(), corrected_translation.begin() + prefix.size(), corrected_translation.end());
    size_t count = prefix.size();
    corrected_suffix.clear();
    if (last_token_is_partial) {
      corrected_suffix.insert(corrected_suffix.end(), prefix.begin(), prefix.end()-1);
      corrected_suffix.push_back(prefix.back() + to_string(count++));
    }
    else {
      corrected_suffix.insert(corrected_suffix.end(), prefix.begin(), prefix.end());
    }
    for (size_t i = count; i < source.size(); ++i) {
      corrected_suffix.push_back("token" + to_string(i));
    }
  }

  virtual void rejectSuffix(const vector<string> &prefix,
                            const vector<string> &suffix,
                            const bool last_token_is_partial,
                                  vector<string> &corrected_suffix)
  {
    setPrefix(prefix, suffix, last_token_is_partial, corrected_suffix);
  }
private:
  const vector<string> source;
};


class RandomImtEngine: public IInteractiveMtEngine {
public:
  RandomImtEngine() {};
  virtual ~RandomImtEngine() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };

  /* Update translation models with source/target pair (total or partial translation) */
  virtual void validate(const vector<string> &source,
                        const vector<string> &target,
                        const vector<bool> &validated)
  {
    cout << "store validated sentence '";
    copy(source.begin(), source.end(), ostream_iterator<string>(cout, " "));
    cout << "' as";
    for (size_t t = 0; t < target.size(); t++) {
      cout << " " << target[t] << "(" << validated[t] << ")";
    }
    cout << "\n";
  }

  /* Set partial validation of a translation */
  virtual void translate(const std::vector<std::string> &source,
                               std::vector<std::string> &target)
  {
    target.resize(source.size());
    for (size_t t = 0; t < target.size(); t++) {
      target[t] = random_string();
    }
  }


  /* Update translation models with source/target pair (total or partial translation) */
  virtual void update(const std::vector<std::string> &source,
                      const std::vector<std::string> &target)
  {
    cout << "store validated sentence '";
    copy(source.begin(), source.end(), ostream_iterator<string>(cout, " "));
    cout << "' as";
    for (size_t t = 0; t < target.size(); t++) {
      cout << " " << target[t];
    }
    cout << "\n";
  }

  /**
   * initialize IMT session
   */
  virtual IInteractiveMtSession *newSession(const vector<string> &source) {
    return new RandomImtSession(source);
  }

  /**
   * delete IMT session
   */
  virtual void deleteSession(IInteractiveMtSession *session) {
    delete session;
  }
};


class RandomImtFactory: public IInteractiveMtFactory {
public:
  RandomImtFactory() { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~RandomImtFactory() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; }

  /**
   * initialize the IMT engine with main-like parameters
   */
  virtual int init(int argc, char *argv[], Context *context = 0) {
    if (argc > 2) { // invalid number of arguments
      return EXIT_FAILURE;
    }

    unsigned int seed = time(NULL);
    if (argc == 2) {
      seed = casmacat::convert_string<unsigned int>(string(argv[1]));
      if (not finite(seed)) { // check if initialization went wrong
        cerr << "Invalid seed = '" << argv[1] << "'\n";
        return EXIT_FAILURE;
      }
    }

    srand(seed);
    return EXIT_SUCCESS;
  }

  virtual string getVersion() { return PACKAGE_VERSION; }


  virtual IInteractiveMtEngine *createInstance(const std::string &specialization_id = "") {
    return new RandomImtEngine();
  }

  virtual void deleteInstance(IInteractiveMtEngine *instance) {
    delete instance;
  }

};

EXPORT_CASMACAT_PLUGIN(IInteractiveMtEngine, RandomImtFactory);

