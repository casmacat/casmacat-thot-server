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
 * IConfidenceEngine.h
 *
 *  Created on: 16/07/2012
 *      Author: valabau
 */

#ifndef CASMACAT_ICONFIDENCEENGINE_H_
#define CASMACAT_ICONFIDENCEENGINE_H_


#include <string>
#include <vector>
#include <casmacat/plugin-utils.h>

namespace casmacat {

/**
 * Interface for Confidence plug-ins
 */

  class IConfidenceEngine {
  public:
    virtual ~IConfidenceEngine() {};

    virtual void getWordConfidences(const std::vector<std::string> &source,
                                    const std::vector<std::string> &target,
                                    const std::vector<bool> &validated,
                                    std::vector<float> &confidences) = 0;
    virtual float getSentenceConfidence(const std::vector<std::string> &source,
                                        const std::vector<std::string> &target,
                                        const std::vector<bool> &validated) = 0;
  };

  class IConfidenceFactory {
  public:
    virtual ~IConfidenceFactory() {};
    /**
     * initialize the Confidence engine with main-like parameters
     */
    virtual int init(int argc, char *argv[]) = 0;
    virtual std::string getVersion() = 0;

    /**
     * create an instance of a confidence engine
     * @param[in] specialization_id returns a specialized version of the confidence engine,
     *            for instance, for user specific models
     */
    virtual IConfidenceEngine *createInstance(const std::string &specialization_id = "") = 0;
  };

}


#endif /* CASMACAT_ICONFIDENCEENGINE_H_ */
