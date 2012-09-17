#ifndef IMTENGINE_HPP
#define IMTENGINE_HPP

#include <string>
#include <vector>
#include <casmacat/NotImplementedException.hpp>

namespace casmacat {

  class IMtEngine {
  public:
    IMtEngine() {};
    IMtEngine(int argc, const char *argv[]) { throw NotImplementedException(METHOD_DEFINITION); }
    virtual ~IMtEngine() {};
    virtual void translate(const std::string &source, 
                             std::string &target
                          ) { throw NotImplementedException(METHOD_DEFINITION); }

  private:
    // Following the rule of three
    IMtEngine& operator=(const IMtEngine&); // Disallow assignment operator
  };

  // function types for creating mt engines 
  typedef IMtEngine* (*create_mt_engine_fn)();
  typedef void (*destroy_mt_engine_fn)(IMtEngine*);
}

#endif
