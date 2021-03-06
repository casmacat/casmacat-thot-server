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
#include <casmacat/IPluginFactory.h>
#include <casmacat/IUpdateable.h>

namespace casmacat {

/**
 * Interface for Alignment plug-ins
 */

  class IAlignmentEngine: public IUpdateable {
  public:
    virtual ~IAlignmentEngine() {};

    /**
     * obtain an alignment matrix from the source and target sentences
     */
    virtual void align(const std::vector<std::string> &source,
                       const std::vector<std::string> &target,
                       std::vector< std::vector<float> > &alignments_out) = 0;
  };

  typedef IPluginFactory<IAlignmentEngine> IAlignmentFactory;
}

#endif /* CASMACAT_IALIGNMENTENGINE_H_ */
