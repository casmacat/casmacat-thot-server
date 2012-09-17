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
 * IAlignmentEngine.h
 *
 *  Created on: 16/07/2012
 *      Author: valabau
 */

#ifndef CASMACAT_IALIGNMENTENGINE_H_
#define CASMACAT_IALIGNMENTENGINE_H_

#include <string>
#include <vector>
#include <casmacat/plugin-utils.h>


namespace casmacat {

/**
 * Interface for Alignment plug-ins
 */

  class IAlignmentEngine {
  public:
    IAlignmentEngine() {};
    virtual ~IAlignmentEngine() {};
    /**
     * initialize the Alignment engine with main-like parameters
     */
    virtual int init(int argc, char *argv[]) { throw NotImplementedException(METHOD_DEFINITION); }
    virtual void align(const std::string &source,
                       const std::string &target,
                       const std::vector< std::vector<float> > &alignments
                          ) { throw NotImplementedException(METHOD_DEFINITION); }

  private:
    // Following the rule of three copy and the assignment operator are disabled
    IAlignmentEngine(const IAlignmentEngine&); // Disallow copy
    IAlignmentEngine& operator=(const IAlignmentEngine&); // Disallow assignment operator
  };

}




#endif /* CASMACAT_IALIGNMENTENGINE_H_ */
