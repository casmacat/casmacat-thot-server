/*
 *   Copyright 2012, valabau
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 * 
 * IImtEngine.h
 *
 *  Created on: 16/07/2012
 *      Author: valabau
 */

#ifndef CASMACAT_IIMTENGINE_H_
#define CASMACAT_IIMTENGINE_H_

#include <string>
#include <vector>
#include <casmacat/plugin-utils.h>


namespace casmacat {

/**
 * Interface for Machine Translation plug-ins
 */

  class IImtEngine {
  public:
    IImtEngine() {};
    virtual ~IImtEngine() {};
    /**
     * initialize the IMT engine with main-like parameters
     */
    virtual int init(int argc, char *argv[]) { throw NotImplementedException(METHOD_DEFINITION); }

    /* Initiate translation */
    virtual void translate(const std::string &source,
                                 std::string &target
                          ) { throw NotImplementedException(METHOD_DEFINITION); }

    /* Set partial validation of a translation */
    virtual void setPartialValidation(const std::string &partial_translation,
                                      const std::vector<bool> &validated,
                                            std::string &corrected_translation,
                                            std::vector<bool> &corrected_validated
                                     ) { throw NotImplementedException(METHOD_DEFINITION); }

    /* Set prefix of a translation */
    virtual void setPrefix(const std::string &prefix,
                           const std::string &suffix,
                                 std::string &corrected_suffix
                          ) { throw NotImplementedException(METHOD_DEFINITION); }

    /* Update translation models with source/target pair (total or partial translation) */
    virtual void validate(const std::string &source,
                          const std::string &target,
                          const std::vector<bool> &validated
                         ) { throw NotImplementedException(METHOD_DEFINITION); }

  private:
    // Following the rule of three copy and the assignment operator are disabled
    IImtEngine(const IImtEngine&);            // Disallow copy
    IImtEngine& operator=(const IImtEngine&); // Disallow assignment operator
  };

}

#endif /* CASMACAT_IIMTENGINE_H_ */
