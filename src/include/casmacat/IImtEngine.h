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

  class IInteractiveMtSession {
  public:
    virtual ~IInteractiveMtSession() {};

    /* Set partial validation of a translation */
    virtual void setPartialValidation(const std::vector<std::string> &partial_translation,
                                      const std::vector<bool> &validated,
                                            std::vector<std::string> &corrected_translation,
                                            std::vector<bool> &corrected_validated
                                     ) = 0;

    /* Set prefix of a translation */
    virtual void setPrefix(const std::vector<std::string> &prefix,
                           const std::vector<std::string> &suffix,
                           std::vector<std::string> &corrected_suffix
                          ) = 0;
  };


  class IInteractiveMtEngine {
  public:
    virtual ~IInteractiveMtEngine() {};

    /**
     * create new IMT session
     */
    virtual IInteractiveMtSession *newSession(const std::vector<std::string> &source) = 0;

    /**
     * delete IMT session
     */
    virtual void deleteSession(IInteractiveMtSession *session) = 0;

    /* Update translation models with source/target pair (total or partial translation) */
    virtual void validate(const std::vector<std::string> &source,
                          const std::vector<std::string> &target,
                          const std::vector<bool> &validated
                         ) = 0;
  };

  class IInteractiveMtFactory {
  public:
    virtual ~IInteractiveMtFactory() {};
    /**
     * initialize the IMT Factory with main-like parameters
     */
    virtual int init(int argc, char *argv[]) = 0;
    virtual std::string getVersion() = 0;

    /**
     * create an instance of a confidence engine
     * @param[in] specialization_id returns a specialized version of the confidence engine,
     *            for instance, for user specific models
     */
    virtual IInteractiveMtEngine *createEngine(const std::string &specialization_id = "") = 0;
  };

}

#endif /* CASMACAT_IIMTENGINE_H_ */
